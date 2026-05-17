//
//  ShareViewController.swift
//  Vesture ShareExtension
//
//  iOS 18 has hard-blocked auto-switching from a share extension to the
//  host app (every path — extensionContext.open, responder-chain openURL:,
//  runtime sharedApplication dispatch — is silently no-op'd on modern
//  share extensions). The reliable handoff pattern is therefore:
//
//    1. Persist the shared image to the App Group container (durable).
//    2. Schedule an immediate local notification.
//    3. Show a brief "Saved" confirmation and dismiss the share sheet.
//
//  The user taps the notification banner → the main app launches → its
//  foreground scan ingests the App Group file and routes to closet-fit-
//  check with the image attached.
//

import UIKit
import UniformTypeIdentifiers
import UserNotifications

final class ShareViewController: UIViewController {

  private static let actionClosetFitCheck = "closet_fit_check"

  // ── Views ──────────────────────────────────────────────────────────────────

  private let cardView = UIView()
  private let imageView = UIImageView()
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let statusLabel = UILabel()
  private let detailLabel = UILabel()

  // ── State ──────────────────────────────────────────────────────────────────

  private var didCompleteRequest = false
  private var safetyExitTimer: Timer?

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    // Belt-and-suspenders: extension MUST exit within 8s no matter what.
    scheduleSafetyExit(after: 8.0)

    Task { [weak self] in
      guard let self else { return }
      let result = await self.persistAndNotify()
      await MainActor.run {
        self.applyResult(result)
        DispatchQueue.main.asyncAfter(deadline: .now() + (result.succeeded ? 1.0 : 1.6)) { [weak self] in
          self?.completeAndExit()
        }
      }
    }
  }

  private func scheduleSafetyExit(after seconds: TimeInterval) {
    safetyExitTimer?.invalidate()
    safetyExitTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
      self?.completeAndExit()
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

    imageView.translatesAutoresizingMaskIntoConstraints = false
    imageView.contentMode = .scaleAspectFit
    imageView.backgroundColor = UIColor(red: 0.94, green: 0.91, blue: 0.86, alpha: 1.0)
    imageView.layer.cornerRadius = 14
    imageView.layer.cornerCurve = .continuous
    imageView.clipsToBounds = true
    cardView.addSubview(imageView)

    activityIndicator.translatesAutoresizingMaskIntoConstraints = false
    activityIndicator.hidesWhenStopped = true
    activityIndicator.startAnimating()
    cardView.addSubview(activityIndicator)

    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.text = "Saving to Vesture…"
    statusLabel.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
    statusLabel.textColor = UIColor.label
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0
    cardView.addSubview(statusLabel)

    detailLabel.translatesAutoresizingMaskIntoConstraints = false
    detailLabel.text = " "
    detailLabel.font = UIFont.systemFont(ofSize: 13)
    detailLabel.textColor = UIColor.secondaryLabel
    detailLabel.textAlignment = .center
    detailLabel.numberOfLines = 0
    cardView.addSubview(detailLabel)

    NSLayoutConstraint.activate([
      cardView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      cardView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      cardView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
      cardView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
      cardView.widthAnchor.constraint(lessThanOrEqualToConstant: 320),

      imageView.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 20),
      imageView.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 20),
      imageView.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -20),
      imageView.heightAnchor.constraint(equalToConstant: 140),

      activityIndicator.centerXAnchor.constraint(equalTo: imageView.centerXAnchor),
      activityIndicator.centerYAnchor.constraint(equalTo: imageView.centerYAnchor),

      statusLabel.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 16),
      statusLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 20),
      statusLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -20),

      detailLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 6),
      detailLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 20),
      detailLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -20),
      detailLabel.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -20),
    ])
  }

  private func applyResult(_ result: PersistResult) {
    activityIndicator.stopAnimating()
    if result.succeeded {
      statusLabel.text = "Saved to Vesture"
      detailLabel.text = result.notificationScheduled
        ? "Tap the Vesture notification to view."
        : "Open Vesture to see the analysis."
    } else {
      statusLabel.text = "Couldn't save the image"
      detailLabel.text = "Try sharing again, or open Vesture directly."
    }
    if let thumb = result.thumbnail { imageView.image = thumb }
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  private func appGroupIdentifier() -> String? {
    Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
  }

  private func mainAppUrlScheme() -> String {
    (Bundle.main.object(forInfoDictionaryKey: "MainAppUrlScheme") as? String) ?? "styleassistant"
  }

  // ── Persistence + notification ────────────────────────────────────────────

  private struct PersistResult {
    let succeeded: Bool
    let notificationScheduled: Bool
    let thumbnail: UIImage?
  }

  private func persistAndNotify() async -> PersistResult {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
      return PersistResult(succeeded: false, notificationScheduled: false, thumbnail: nil)
    }
    for item in extensionItems {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          if let detail = await persistImage(from: provider) {
            let notified = await scheduleHandoffNotification(shareId: detail.shareId, imagePath: detail.imagePath, thumbnail: detail.thumbnail)
            return PersistResult(succeeded: true, notificationScheduled: notified, thumbnail: detail.thumbnail)
          }
        }
      }
    }
    return PersistResult(succeeded: false, notificationScheduled: false, thumbnail: nil)
  }

  private struct PersistedShare {
    let shareId: String
    let imagePath: String
    let thumbnail: UIImage?
  }

  private func persistImage(from provider: NSItemProvider) async -> PersistedShare? {
    guard let appGroup = appGroupIdentifier() else { return nil }
    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      return nil
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
      return nil
    }

    guard let data = imageData, !data.isEmpty else { return nil }

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
      return nil
    }

    return PersistedShare(shareId: shareId, imagePath: imageURL.path, thumbnail: thumbnail)
  }

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

  /// Schedules an immediate local notification so the user has a one-tap path
  /// back into Vesture from the share sheet. Returns false if the host app
  /// hasn't been granted notification permission (in which case the user will
  /// need to open Vesture manually — the foreground scan still ingests the
  /// shared image).
  private func scheduleHandoffNotification(shareId: String, imagePath: String, thumbnail: UIImage?) async -> Bool {
    let center = UNUserNotificationCenter.current()

    // Check the host app's notification settings. The extension shares the
    // host's bundle identifier so this reflects whether the user has granted
    // notification permission to Vesture itself.
    let settings = await center.notificationSettings()
    let canDisplay = settings.authorizationStatus == .authorized
      || settings.authorizationStatus == .provisional
      || settings.authorizationStatus == .ephemeral
    guard canDisplay else { return false }

    let content = UNMutableNotificationContent()
    content.title = "Check this in your closet?"
    content.body = "Tap to analyse this piece against your wardrobe."
    content.sound = .default
    content.userInfo = [
      "shareId": shareId,
      "action": Self.actionClosetFitCheck,
      "imagePath": imagePath,
    ]
    content.categoryIdentifier = "VESTURE_CLOSET_FIT_CHECK"

    // Attach the thumbnail so the notification banner shows the image preview.
    // The attachment file must live in a directory the system can read; we
    // copy it into the extension's temp directory and reference that path.
    if let attachmentURL = await copyForNotificationAttachment(imagePath: imagePath) {
      do {
        let attachment = try UNNotificationAttachment(identifier: shareId, url: attachmentURL, options: nil)
        content.attachments = [attachment]
      } catch {
        // Non-fatal — notification still displays without the thumbnail.
      }
    }

    // Trigger after ~0.4s — long enough for iOS to dismiss the share sheet
    // smoothly before the notification banner slides in.
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.4, repeats: false)
    let request = UNNotificationRequest(identifier: shareId, content: content, trigger: trigger)

    return await withCheckedContinuation { continuation in
      center.add(request) { error in
        continuation.resume(returning: error == nil)
      }
    }
  }

  /// UNNotificationAttachment requires a file the system can move into its
  /// own cache. The original App Group file would work for reads but the
  /// system needs ownership — copy into the extension's tmp directory.
  private func copyForNotificationAttachment(imagePath: String) async -> URL? {
    let sourceURL = URL(fileURLWithPath: imagePath)
    let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString)-\(sourceURL.lastPathComponent)")
    do {
      try FileManager.default.copyItem(at: sourceURL, to: tmp)
      return tmp
    } catch {
      return nil
    }
  }

  // ── Completion ─────────────────────────────────────────────────────────────

  @MainActor
  private func completeAndExit() {
    guard !didCompleteRequest else { return }
    didCompleteRequest = true
    safetyExitTimer?.invalidate()
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
