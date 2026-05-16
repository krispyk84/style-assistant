//
//  ShareViewController.swift
//  Vesture ShareExtension
//
//  Pure no-UI share extension. Accepts an image from the iOS share sheet,
//  writes it into the App Group container with a JSON sidecar of metadata,
//  and opens the main app via the custom URL scheme so the app can pick up
//  the pending share and route into "Does this work in my closet?".
//
//  The auto-open is performed via the documented responder-chain walk to
//  `openURL:` — the only pattern Apple has tolerated for share extensions
//  for over a decade. If iOS ever blocks it, the file + sidecar remain in
//  the App Group container and a future foreground scan can pick them up
//  without losing the user's image.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

  private static let actionClosetFitCheck = "closet_fit_check"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { [weak self] in
      await self?.handleSharedItems()
      await MainActor.run { [weak self] in
        self?.completeAndExit()
      }
    }
  }

  // MARK: - Configuration

  private func appGroupIdentifier() -> String? {
    return Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
  }

  private func mainAppUrlScheme() -> String {
    return (Bundle.main.object(forInfoDictionaryKey: "MainAppUrlScheme") as? String) ?? "styleassistant"
  }

  // MARK: - Completion

  @MainActor
  private func completeAndExit() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }

  // MARK: - Item handling

  private func handleSharedItems() async {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else { return }
    for item in extensionItems {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          let didPersist = await persistImage(from: provider)
          if didPersist { return }  // Only handle the first valid image.
        }
      }
    }
  }

  /// Reads the image, writes it + a JSON metadata sidecar into the App Group
  /// container, prunes shares older than 24h, and triggers auto-open of the
  /// main app. Returns `true` if a non-empty image was persisted.
  private func persistImage(from provider: NSItemProvider) async -> Bool {
    guard let appGroup = appGroupIdentifier() else { return false }
    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      return false
    }

    var imageData: Data?
    var imageExt = "jpg"

    do {
      let item = try await provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil)
      if let url = item as? URL {
        imageData = try? Data(contentsOf: url)
        let ext = url.pathExtension.lowercased()
        if !ext.isEmpty { imageExt = ext }
      } else if let image = item as? UIImage {
        imageData = image.jpegData(compressionQuality: 0.9)
        imageExt = "jpg"
      } else if let raw = item as? Data {
        imageData = raw
      }
    } catch {
      return false
    }

    guard let data = imageData, !data.isEmpty else { return false }

    let directory = containerURL.appendingPathComponent("pendingShares", isDirectory: true)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    pruneOldShares(directory: directory)

    let timestamp = Int(Date().timeIntervalSince1970 * 1000)
    let shareId = "share-\(timestamp)"
    let imageURL = directory.appendingPathComponent("\(shareId).\(imageExt)")
    let metaURL = directory.appendingPathComponent("\(shareId).json")

    do {
      try data.write(to: imageURL, options: .atomic)
      let metadata: [String: Any] = [
        "id": shareId,
        "source": "share_extension",
        "action": Self.actionClosetFitCheck,
        "imagePath": imageURL.path,
        "imageFileName": imageURL.lastPathComponent,
        "createdAt": ISO8601DateFormatter().string(from: Date()),
      ]
      let metaData = try JSONSerialization.data(withJSONObject: metadata, options: [])
      try metaData.write(to: metaURL, options: .atomic)
    } catch {
      return false
    }

    await MainActor.run {
      openMainApp(shareId: shareId, imagePath: imageURL.path)
    }
    return true
  }

  /// Best-effort cleanup so the App Group container does not grow unbounded
  /// after dozens of shares. Anything older than 24h is removed — long
  /// enough that the main app has had every reasonable chance to pick up
  /// the pending share.
  private func pruneOldShares(directory: URL) {
    guard let entries = try? FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: [.contentModificationDateKey]
    ) else { return }
    let cutoff = Date().addingTimeInterval(-60 * 60 * 24)
    for entry in entries {
      if let mod = try? entry.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
         mod < cutoff {
        try? FileManager.default.removeItem(at: entry)
      }
    }
  }

  // MARK: - Opening the main app

  @MainActor
  private func openMainApp(shareId: String, imagePath: String) {
    let scheme = mainAppUrlScheme()
    var components = URLComponents()
    components.scheme = scheme
    components.host = "share-handoff"
    components.queryItems = [
      URLQueryItem(name: "id", value: shareId),
      URLQueryItem(name: "path", value: imagePath),
      URLQueryItem(name: "action", value: Self.actionClosetFitCheck),
    ]
    guard let url = components.url else { return }

    // Walk the responder chain to find a responder that handles `openURL:`.
    // UIApplication on iOS conforms to UIResponder; in the share-extension
    // context the chain reaches the host app's UIApplication via the
    // extensionContext's link, and `openURL:` is the legacy selector still
    // exposed on UIApplication that App Review tolerates from extensions.
    let selector = NSSelectorFromString("openURL:")
    var responder: UIResponder? = self
    while let current = responder {
      if current.responds(to: selector) {
        _ = current.perform(selector, with: url)
        return
      }
      responder = current.next
    }
  }
}
