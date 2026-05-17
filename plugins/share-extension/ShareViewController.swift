//
//  ShareViewController.swift
//  Vesture ShareExtension
//
//  Strategy: persist the shared image to the App Group container the moment
//  the extension loads, then aggressively attempt to auto-launch the main app
//  via three independent code paths (extensionContext.open, responder-chain
//  openURL:, and the NSClassFromString sharedApplication fallback). The UI is
//  intentionally minimal — a small "Opening Vesture…" card that flips to a
//  visible "Open Vesture" button only if auto-launch hasn't fired after a
//  short delay (some iOS versions silently block all auto-launch paths from
//  share extensions; if that happens, the user gets a single-tap escape).
//
//  Either way, the image is in the App Group container by the time the host
//  app foregrounds, so the main app's foreground scan ingests it whether the
//  switch came from auto-launch or from manual reopen.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

  private static let actionClosetFitCheck = "closet_fit_check"

  // ── Views ──────────────────────────────────────────────────────────────────

  private let cardView = UIView()
  private let imageView = UIImageView()
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let statusLabel = UILabel()
  private let manualOpenButton = UIButton(type: .system)

  // ── State ──────────────────────────────────────────────────────────────────

  private var pendingShareId: String?
  private var pendingImagePath: String?
  private var didAttemptOpen = false
  private var didCompleteRequest = false
  private var safetyExitTimer: Timer?

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    // SAFETY: regardless of what happens, the extension MUST complete within a
    // bounded time so the share sheet doesn't end up wedged on screen.
    scheduleSafetyExit(after: 8.0)

    Task { [weak self] in
      guard let self else { return }
      let ok = await self.persistFirstImage()
      await MainActor.run {
        if ok, let id = self.pendingShareId, let path = self.pendingImagePath {
          self.openMainAppAllStrategies(shareId: id, imagePath: path)
          self.didAttemptOpen = true
          // If iOS DID switch apps, the extension is being torn down right now
          // and the timer below never fires. If iOS didn't, we surface the
          // manual button after a moment.
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { [weak self] in
            self?.revealManualButtonIfStillVisible()
          }
          // And whether or not the switch happened, complete the request after
          // a brief settle so we don't hang the share sheet indefinitely.
          DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            self?.completeAndExit()
          }
        } else {
          self.statusLabel.text = "Couldn't load the image"
          self.activityIndicator.stopAnimating()
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.completeAndExit()
          }
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
    statusLabel.text = "Opening Vesture…"
    statusLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
    statusLabel.textColor = UIColor.label
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 0
    cardView.addSubview(statusLabel)

    manualOpenButton.translatesAutoresizingMaskIntoConstraints = false
    manualOpenButton.isHidden = true
    manualOpenButton.setTitle("Open Vesture", for: .normal)
    manualOpenButton.setTitleColor(.white, for: .normal)
    manualOpenButton.titleLabel?.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
    manualOpenButton.backgroundColor = UIColor(red: 0.69, green: 0.39, blue: 0.15, alpha: 1.0)
    manualOpenButton.layer.cornerRadius = 20
    manualOpenButton.layer.cornerCurve = .continuous
    manualOpenButton.addTarget(self, action: #selector(manualOpenTapped), for: .touchUpInside)
    cardView.addSubview(manualOpenButton)

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

      manualOpenButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 14),
      manualOpenButton.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 20),
      manualOpenButton.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -20),
      manualOpenButton.heightAnchor.constraint(equalToConstant: 42),
      manualOpenButton.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -20),
    ])
  }

  private func revealManualButtonIfStillVisible() {
    // If the view is still in the window hierarchy after we tried to auto-
    // open, iOS didn't honor the URL — give the user a tap fallback.
    guard view.window != nil, !didCompleteRequest else { return }
    statusLabel.text = "Tap to switch to Vesture"
    activityIndicator.stopAnimating()
    manualOpenButton.isHidden = false
  }

  @objc private func manualOpenTapped() {
    if let id = pendingShareId, let path = pendingImagePath {
      openMainAppAllStrategies(shareId: id, imagePath: path)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      self?.completeAndExit()
    }
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  private func appGroupIdentifier() -> String? {
    Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
  }

  private func mainAppUrlScheme() -> String {
    (Bundle.main.object(forInfoDictionaryKey: "MainAppUrlScheme") as? String) ?? "styleassistant"
  }

  // ── Image persistence ─────────────────────────────────────────────────────

  private func persistFirstImage() async -> Bool {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else { return false }
    for item in extensionItems {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          if await persistImage(from: provider) { return true }
        }
      }
    }
    return false
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

  // ── Auto-open: three independent strategies ───────────────────────────────

  @MainActor
  private func openMainAppAllStrategies(shareId: String, imagePath: String) {
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

    // Strategy 1: Apple-supported extensionContext.open(_:).
    // Apple's docs note share extensions may opt out (returns false silently)
    // but newer iOS sometimes honours it. Cheap to try.
    extensionContext?.open(url, completionHandler: nil)

    // Strategy 2: Responder-chain openURL:. The classic pattern; still the
    // workhorse for share extensions in practice.
    let selector = NSSelectorFromString("openURL:")
    var responder: UIResponder? = self
    while let current = responder {
      if current.responds(to: selector) {
        _ = current.perform(selector, with: url)
        return
      }
      responder = current.next
    }

    // Strategy 3: Last-resort fallback — find UIApplication via runtime even
    // if it isn't in our responder chain. Apps in production have shipped this
    // for years; App Review tolerates it for share extensions.
    if let appClass = NSClassFromString("UIApplication") as? NSObject.Type {
      let sharedSel = NSSelectorFromString("sharedApplication")
      if appClass.responds(to: sharedSel),
         let unmanaged = appClass.perform(sharedSel),
         let app = unmanaged.takeUnretainedValue() as? NSObject {
        _ = app.perform(selector, with: url)
      }
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
