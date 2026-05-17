//
//  ShareViewController.swift
//  Vesture ShareExtension
//
//  Share extension with a small interactive UI: thumbnail of the shared
//  image, headline, and an "Open in Vesture" button. The button calls
//  openURL: via the responder chain from a USER-INITIATED tap, which is
//  the most permissive path Apple still tolerates from a share extension
//  (the silent-auto-open trick from viewDidAppear has been increasingly
//  blocked on iOS 17/18).
//
//  Even if the URL open silently fails, the image has already been
//  persisted to the App Group container by the time the UI appears, so
//  the main app's foreground scan will pick it up the moment the user
//  switches back to Vesture.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

  private static let actionClosetFitCheck = "closet_fit_check"

  // ── Views ──────────────────────────────────────────────────────────────────

  private let cardView = UIView()
  private let imageContainer = UIView()
  private let imageView = UIImageView()
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let openButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)

  // ── State ──────────────────────────────────────────────────────────────────

  private var pendingShareId: String?
  private var pendingImagePath: String?
  private var didPersistFail = false

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
    updateReadyState()
    Task { [weak self] in
      await self?.persistFirstImage()
      await MainActor.run { [weak self] in
        self?.updateReadyState()
      }
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private func setupUI() {
    view.backgroundColor = UIColor.black.withAlphaComponent(0.45)

    cardView.translatesAutoresizingMaskIntoConstraints = false
    cardView.backgroundColor = UIColor { tc in tc.userInterfaceStyle == .dark ? UIColor(white: 0.10, alpha: 1.0) : UIColor.white }
    cardView.layer.cornerRadius = 24
    cardView.layer.cornerCurve = .continuous
    cardView.clipsToBounds = true
    view.addSubview(cardView)

    imageContainer.translatesAutoresizingMaskIntoConstraints = false
    imageContainer.backgroundColor = UIColor(red: 0.94, green: 0.91, blue: 0.86, alpha: 1.0) // warm beige
    imageContainer.layer.cornerRadius = 14
    imageContainer.layer.cornerCurve = .continuous
    imageContainer.clipsToBounds = true
    cardView.addSubview(imageContainer)

    imageView.translatesAutoresizingMaskIntoConstraints = false
    imageView.contentMode = .scaleAspectFit
    imageView.backgroundColor = .clear
    imageContainer.addSubview(imageView)

    activityIndicator.translatesAutoresizingMaskIntoConstraints = false
    activityIndicator.hidesWhenStopped = true
    activityIndicator.startAnimating()
    imageContainer.addSubview(activityIndicator)

    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.text = "Check this in your closet?"
    titleLabel.font = UIFont.systemFont(ofSize: 19, weight: .semibold)
    titleLabel.textColor = UIColor.label
    titleLabel.textAlignment = .center
    titleLabel.numberOfLines = 0
    cardView.addSubview(titleLabel)

    subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
    subtitleLabel.text = "Vesture will analyse this against your closet."
    subtitleLabel.font = UIFont.systemFont(ofSize: 13)
    subtitleLabel.textColor = UIColor.secondaryLabel
    subtitleLabel.textAlignment = .center
    subtitleLabel.numberOfLines = 0
    cardView.addSubview(subtitleLabel)

    openButton.translatesAutoresizingMaskIntoConstraints = false
    openButton.setTitle("Open in Vesture", for: .normal)
    openButton.setTitleColor(.white, for: .normal)
    openButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
    openButton.backgroundColor = UIColor(red: 0.69, green: 0.39, blue: 0.15, alpha: 1.0) // Vesture accent
    openButton.layer.cornerRadius = 24
    openButton.layer.cornerCurve = .continuous
    openButton.addTarget(self, action: #selector(openTapped), for: .touchUpInside)
    cardView.addSubview(openButton)

    cancelButton.translatesAutoresizingMaskIntoConstraints = false
    cancelButton.setTitle("Cancel", for: .normal)
    cancelButton.setTitleColor(UIColor.secondaryLabel, for: .normal)
    cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 15)
    cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
    cardView.addSubview(cancelButton)

    NSLayoutConstraint.activate([
      cardView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      cardView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      cardView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
      cardView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
      cardView.widthAnchor.constraint(lessThanOrEqualToConstant: 360),

      imageContainer.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 24),
      imageContainer.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
      imageContainer.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),
      imageContainer.heightAnchor.constraint(equalToConstant: 220),

      imageView.leadingAnchor.constraint(equalTo: imageContainer.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: imageContainer.trailingAnchor),
      imageView.topAnchor.constraint(equalTo: imageContainer.topAnchor),
      imageView.bottomAnchor.constraint(equalTo: imageContainer.bottomAnchor),

      activityIndicator.centerXAnchor.constraint(equalTo: imageContainer.centerXAnchor),
      activityIndicator.centerYAnchor.constraint(equalTo: imageContainer.centerYAnchor),

      titleLabel.topAnchor.constraint(equalTo: imageContainer.bottomAnchor, constant: 18),
      titleLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
      titleLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

      subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
      subtitleLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
      subtitleLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

      openButton.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 20),
      openButton.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
      openButton.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),
      openButton.heightAnchor.constraint(equalToConstant: 50),

      cancelButton.topAnchor.constraint(equalTo: openButton.bottomAnchor, constant: 4),
      cancelButton.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
      cancelButton.heightAnchor.constraint(equalToConstant: 36),
      cancelButton.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -16),
    ])
  }

  private func updateReadyState() {
    let ready = (pendingShareId != nil)
    openButton.isEnabled = ready
    openButton.alpha = ready ? 1.0 : 0.45
    if ready {
      activityIndicator.stopAnimating()
    } else if didPersistFail {
      activityIndicator.stopAnimating()
      titleLabel.text = "Couldn't load the image"
      subtitleLabel.text = "Try sharing again or open Vesture directly."
    }
  }

  // ── Button handlers ────────────────────────────────────────────────────────

  @objc private func openTapped() {
    guard let shareId = pendingShareId, let imagePath = pendingImagePath else {
      completeAndExit()
      return
    }
    openMainApp(shareId: shareId, imagePath: imagePath)
    // Give the system a moment to action the URL before we tear the
    // extension context down — completing too eagerly can race the open.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
      self?.completeAndExit()
    }
  }

  @objc private func cancelTapped() {
    completeAndExit()
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  private func appGroupIdentifier() -> String? {
    Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
  }

  private func mainAppUrlScheme() -> String {
    (Bundle.main.object(forInfoDictionaryKey: "MainAppUrlScheme") as? String) ?? "styleassistant"
  }

  // ── Image persistence ─────────────────────────────────────────────────────

  private func persistFirstImage() async {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
      await MainActor.run { self.didPersistFail = true }
      return
    }
    for item in extensionItems {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          let ok = await persistImage(from: provider)
          if ok { return }
        }
      }
    }
    await MainActor.run { self.didPersistFail = true }
  }

  private func persistImage(from provider: NSItemProvider) async -> Bool {
    guard let appGroup = appGroupIdentifier() else { return false }
    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      return false
    }

    var imageData: Data?
    var imageExt = "jpg"
    var thumbnail: UIImage?

    do {
      let item = try await provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil)
      if let url = item as? URL {
        imageData = try? Data(contentsOf: url)
        let ext = url.pathExtension.lowercased()
        if !ext.isEmpty { imageExt = ext }
        if let data = imageData { thumbnail = UIImage(data: data) }
      } else if let image = item as? UIImage {
        imageData = image.jpegData(compressionQuality: 0.9)
        imageExt = "jpg"
        thumbnail = image
      } else if let raw = item as? Data {
        imageData = raw
        thumbnail = UIImage(data: raw)
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
      self.pendingShareId = shareId
      self.pendingImagePath = imageURL.path
      if let thumb = thumbnail { self.imageView.image = thumb }
    }
    return true
  }

  /// Keeps the App Group container from growing unbounded.
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

  // ── Open main app ──────────────────────────────────────────────────────────

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

    // Two attempts at handing off to the host app, in order of preference:
    //
    //   1. extensionContext.open(_:) — the only Apple-supported path. For
    //      share extensions Apple's docs say "the extension point determines
    //      whether to support this method", so it may quietly do nothing,
    //      but where it works it is the cleanest.
    //
    //   2. Responder-chain openURL: — the legacy hack. Tolerated since iOS 9.
    //      Most permissive when called from a user-initiated tap (this method
    //      is only ever called from `openTapped`).
    //
    // Either way, the image has already been written to the App Group
    // container, so the main app's foreground scan picks it up as soon as
    // the user is in Vesture — whether iOS auto-launches us or not.

    extensionContext?.open(url, completionHandler: nil)

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

  // ── Completion ─────────────────────────────────────────────────────────────

  @MainActor
  private func completeAndExit() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
