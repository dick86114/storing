import AppKit
import QiankunjieReader
import SwiftUI
import WebKit

/// 只承载服务端正文的受控视图；导航、存储和脚本能力都在这里收紧。
struct ReaderWebView: NSViewRepresentable {
    let html: String
    let contentToken: String
    let savedReadingState: Data?
    let baseURL: URL?
    let onReadingStateChange: @MainActor (Data, String) -> Void

    func makeNSView(context: Context) -> ReaderWKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.allowsInlinePredictions = false

        let webView = ReaderWKWebView(
            frame: .zero,
            configuration: configuration
        )
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isInspectable = false
        webView.onReadingStateChange = { state, token in
            context.coordinator.handleReadingState(state, token: token)
        }
        context.coordinator.webView = webView
        webView.loadServerHTML(
            html,
            baseURL: baseURL,
            token: contentToken,
            savedState: savedReadingState
        )
        return webView
    }

    func updateNSView(_ webView: ReaderWKWebView, context: Context) {
        guard webView.loadedToken != contentToken else {
            return
        }

        webView.loadServerHTML(
            html,
            baseURL: baseURL,
            token: contentToken,
            savedState: savedReadingState
        )
    }

    func makeCoordinator() -> ReaderWebViewCoordinator {
        ReaderWebViewCoordinator(onReadingStateChange: onReadingStateChange)
    }
}

@MainActor
final class ReaderWebViewCoordinator: NSObject, WKNavigationDelegate {
    private let onReadingStateChange: @MainActor (Data, String) -> Void
    weak var webView: ReaderWKWebView?

    init(onReadingStateChange: @escaping @MainActor (Data, String) -> Void) {
        self.onReadingStateChange = onReadingStateChange
    }

    func handleReadingState(_ state: Data, token: String) {
        onReadingStateChange(state, token)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        let url = navigationAction.request.url

        if navigationAction.targetFrame?.isMainFrame != true {
            if let url, ReaderNavigationPolicy.isSupportedResourceURL(url) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
            return
        }

        switch Self.mainNavigationAction(
            url: url,
            isServerHTMLLoading: (webView as? ReaderWKWebView)?.isServerHTMLLoading == true,
            navigationType: navigationAction.navigationType
        ) {
        case .allow:
            decisionHandler(.allow)
        case .openExternally(let url):
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        case .block:
            decisionHandler(.cancel)
        }
    }

    static func mainNavigationAction(
        url: URL?,
        isServerHTMLLoading: Bool,
        navigationType: WKNavigationType
    ) -> ReaderMainNavigationAction {
        if isServerHTMLLoading {
            return .allow
        }

        guard let url else {
            return .block
        }

        switch ReaderNavigationPolicy.decision(for: url) {
        case .openExternally:
            return .openExternally(url)
        case .load, .block:
            return .block
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            if ReaderNavigationPolicy.decision(for: url) == .openExternally {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation!
    ) {
        guard let readerWebView = webView as? ReaderWKWebView else {
            return
        }
        readerWebView.restoreReadingState()
    }
}

enum ReaderMainNavigationAction: Equatable {
    case allow
    case openExternally(URL)
    case block
}

@MainActor
final class ReaderWKWebView: WKWebView {
    var loadedToken = ""
    var isServerHTMLLoading = false
    var pendingReadingState: Data?
    var onReadingStateChange: ((Data, String) -> Void)?
    private var stateCaptureTask: Task<Void, Never>?

    func loadServerHTML(
        _ html: String,
        baseURL: URL?,
        token: String,
        savedState: Data?
    ) {
        loadedToken = token
        isServerHTMLLoading = true
        pendingReadingState = savedState
        stateCaptureTask?.cancel()
        loadHTMLString(html, baseURL: baseURL)
    }

    func restoreReadingState() {
        guard let data = pendingReadingState,
              let state = Self.readingState(from: data) else {
            pendingReadingState = nil
            return
        }

        interactionState = state
        pendingReadingState = nil
        isServerHTMLLoading = false
    }

    private static func readingState(from data: Data) -> Any? {
        do {
            let unarchiver = try NSKeyedUnarchiver(forReadingFrom: data)
            unarchiver.requiresSecureCoding = false
            let state = unarchiver.decodeObject(forKey: "root")
            unarchiver.finishDecoding()
            return state
        } catch {
            return nil
        }
    }

    override func scrollWheel(with event: NSEvent) {
        super.scrollWheel(with: event)
        scheduleReadingStateCapture()
    }

    override func keyDown(with event: NSEvent) {
        super.keyDown(with: event)
        scheduleReadingStateCapture()
    }

    override func viewDidEndLiveResize() {
        super.viewDidEndLiveResize()
        scheduleReadingStateCapture()
    }

    private func scheduleReadingStateCapture() {
        stateCaptureTask?.cancel()
        stateCaptureTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(220))
            guard let self, !Task.isCancelled else {
                return
            }

            self.captureReadingState()
        }
    }

    private func captureReadingState() {
        guard let interactionState else {
            return
        }

        let data = try? NSKeyedArchiver.archivedData(
            withRootObject: interactionState,
            requiringSecureCoding: false
        )
        if let data {
            onReadingStateChange?(data, loadedToken)
        }
    }
}

extension ReaderNavigationPolicy {
    static func isSupportedResourceURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }
        return scheme == "http" || scheme == "https"
    }
}
