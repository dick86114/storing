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
    let displayStyle: ReaderContentStyle
    let onReadingStateChange: @MainActor (Data, String) -> Void
    let onImageSelected: @MainActor (URL) -> Void

    func makeNSView(context: Context) -> ReaderWebViewContainer {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.allowsInlinePredictions = false
        configuration.userContentController.add(
            ReaderImageMessageHandler(delegate: context.coordinator),
            name: "readerImage"
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: ReaderContentStyle.imageSelectionScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true,
                in: .page
            )
        )

        let webView = ReaderWKWebView(
            frame: .zero,
            configuration: configuration
        )
        webView.appearance = Self.appearance(for: displayStyle.colorScheme)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isInspectable = false
        webView.onReadingStateChange = { state, token in
            context.coordinator.handleReadingState(state, token: token)
        }
        context.coordinator.webView = webView
        let container = ReaderWebViewContainer()
        container.translatesAutoresizingMaskIntoConstraints = true
        container.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        webView.loadServerHTML(
            html,
            baseURL: baseURL,
            token: contentToken,
            savedState: savedReadingState,
            displayStyle: displayStyle
        )
        return container
    }

    func updateNSView(_ container: ReaderWebViewContainer, context: Context) {
        guard let webView = container.subviews.compactMap({ $0 as? ReaderWKWebView }).first else {
            return
        }

        let appearance = Self.appearance(for: displayStyle.colorScheme)
        if webView.appearance?.name != appearance?.name {
            webView.appearance = appearance
        }

        if webView.loadedToken != contentToken {
            webView.loadServerHTML(
                html,
                baseURL: baseURL,
                token: contentToken,
                savedState: savedReadingState,
                displayStyle: displayStyle
            )
            return
        } else {
            webView.apply(displayStyle)
        }
    }

    func makeCoordinator() -> ReaderWebViewCoordinator {
        ReaderWebViewCoordinator(
            onReadingStateChange: onReadingStateChange,
            onImageSelected: onImageSelected
        )
    }

    /// 让正文 WebView 的外观与应用内“外观”设置保持一致，
    /// 这样原文里的 prefers-color-scheme 分支也会跟着切换。
    private static func appearance(for colorScheme: ColorScheme) -> NSAppearance? {
        NSAppearance(named: colorScheme == .dark ? .darkAqua : .aqua)
    }
}

final class ReaderWebViewContainer: NSView {
    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: NSView.noIntrinsicMetric)
    }
}

struct ReaderContentStyle {
    let font: AppFontPreference
    let contentWidth: ReaderContentWidthPreference
    let colorScheme: ColorScheme

    init(
        font: AppFontPreference,
        contentWidth: ReaderContentWidthPreference,
        colorScheme: ColorScheme = .light
    ) {
        self.font = font
        self.contentWidth = contentWidth
        self.colorScheme = colorScheme
    }

    var token: String {
        "\(font.rawValue)-\(contentWidth.rawValue)-\(themeName)"
    }

    /// 主题名写进 HTML 属性，光标样式和正文脚本都以它为唯一来源。
    var themeName: String {
        colorScheme == .dark ? "dark" : "light"
    }

    private var css: String {
        """
        <style>
          :root {
            --reader-font-size: \(Int(font.pointSize))px;
            --reader-content-width: \(contentWidth.cssWidth);
            --reader-dark-background: #071A12;
            --reader-dark-text: #E8E4DC;
            --reader-dark-accent: #C9A84C;
            color-scheme: \(themeName);
          }
          body {
            max-width: var(--reader-content-width) !important;
            margin: 0 auto !important;
            padding: 32px 24px 64px !important;
            font-size: var(--reader-font-size) !important;
            line-height: 1.75 !important;
          }
          html, body {
            overflow-x: hidden !important;
          }
          body, body * {
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
          pre, code {
            white-space: pre-wrap !important;
          }
          table {
            display: block !important;
            max-width: 100% !important;
            overflow-x: auto !important;
          }
          body > main,
          body > article {
            max-width: 100% !important;
            margin-inline: auto !important;
          }
          .storing-cover {
            margin: 0 0 24px !important;
          }
          .storing-cover img {
            display: block !important;
            width: 100% !important;
            aspect-ratio: 2.35 !important;
            object-fit: cover !important;
            border-radius: 14px !important;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
            cursor: zoom-in !important;
          }
          html[data-storing-reader-theme="dark"] {
            background-color: var(--reader-dark-background) !important;
          }
          html[data-storing-reader-theme="dark"] body {
            background-color: var(--reader-dark-background) !important;
            color: var(--reader-dark-text) !important;
          }
          html[data-storing-reader-theme="dark"] a {
            color: var(--reader-dark-accent);
          }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb {
            background-color: rgba(127, 127, 127, 0.38);
            background-clip: content-box;
            border: 2px solid transparent;
            border-radius: 4px;
          }
          html[data-storing-reader-theme="dark"] ::-webkit-scrollbar-thumb {
            background-color: rgba(232, 228, 220, 0.26);
          }
          html[data-storing-reader-theme="dark"] ::selection {
            background-color: rgba(201, 168, 76, 0.35);
          }
        </style>
        """
    }

    /// 抓到站点的正文样式仍以浅色为主，深色下需要把内联背景和文字统一压到暗色体系。
    static let readerThemeScript = #"""
    (function () {
      var ATTR = 'data-storing-reader-theme';
      var MEDIA_SELECTOR = 'svg, img, video, canvas, picture, iframe, object, embed';
      var BORDER_SPECS = [
        { color: 'border-top-color', width: 'border-top-width' },
        { color: 'border-right-color', width: 'border-right-width' },
        { color: 'border-bottom-color', width: 'border-bottom-width' },
        { color: 'border-left-color', width: 'border-left-width' }
      ];
      var DARK_BACKGROUND_LUMINANCE = 0.0075;
      var MIN_TEXT_CONTRAST = 4.5;
      var entries = new Map();
      var currentMode = null;
      var refreshScheduled = false;

      function parseColor(value) {
        if (!value) return null;
        var match = String(value).match(/^rgba?\(([^)]+)\)$/i);
        if (!match) return null;
        var parts = match[1].split(',');
        if (parts.length < 3) return null;
        var color = {
          r: parseFloat(parts[0]),
          g: parseFloat(parts[1]),
          b: parseFloat(parts[2]),
          a: parts.length > 3 ? parseFloat(parts[3]) : 1
        };
        if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b)) return null;
        if (isNaN(color.a)) color.a = 1;
        return color;
      }

      function channel(value) {
        var v = Math.min(255, Math.max(0, value)) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }

      function luminance(color) {
        return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      }

      /** 与正文深色底的对比度，用来判断文字是否还需要提亮。 */
      function contrastOnDark(color) {
        var value = luminance(color);
        var lighter = Math.max(value, DARK_BACKGROUND_LUMINANCE);
        var darker = Math.min(value, DARK_BACKGROUND_LUMINANCE);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function toHsl(color) {
        var r = color.r / 255;
        var g = color.g / 255;
        var b = color.b / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var l = (max + min) / 2;
        var s = 0;
        var h = 0;
        var delta = max - min;
        if (delta > 0) {
          s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
          if (max === r) {
            h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
          } else if (max === g) {
            h = ((b - r) / delta + 2) / 6;
          } else {
            h = ((r - g) / delta + 4) / 6;
          }
        }
        return { h: h, s: s, l: l };
      }

      function fromHsl(hsl, alpha) {
        var h = hsl.h;
        var s = Math.min(1, Math.max(0, hsl.s));
        var l = Math.min(1, Math.max(0, hsl.l));

        function hue(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        }

        var r = l;
        var g = l;
        var b = l;
        if (s > 0) {
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = hue(p, q, h + 1 / 3);
          g = hue(p, q, h);
          b = hue(p, q, h - 1 / 3);
        }

        var safeAlpha = Math.round(Math.min(1, Math.max(0, alpha)) * 100) / 100;
        return 'rgba(' + Math.round(r * 255) + ', ' + Math.round(g * 255) + ', ' + Math.round(b * 255) + ', ' + safeAlpha + ')';
      }

      function surfaceValue(color) {
        if (!color) return null;
        if (color.a < 0.15) return null;
        if (luminance(color) <= 0.55) return null;
        var hsl = toHsl(color);
        hsl.l = Math.min(0.30, 0.072 + (1 - hsl.l) * 0.24);
        hsl.s = Math.min(hsl.s, 0.30);
        return fromHsl(hsl, color.a);
      }

      function textValue(color) {
        if (!color) return null;
        if (color.a < 0.15) return null;
        if (contrastOnDark(color) >= MIN_TEXT_CONTRAST) return null;
        var hsl = toHsl(color);
        hsl.l = Math.max(0.62, 0.90 - hsl.l * 0.55);
        hsl.s = Math.min(hsl.s, 0.42);
        return fromHsl(hsl, color.a);
      }

      function borderValue(color) {
        if (!color) return null;
        if (color.a < 0.15) return null;
        var lum = luminance(color);
        var hsl = toHsl(color);
        if (lum > 0.55) {
          hsl.l = Math.min(0.30, 0.16 + (1 - hsl.l) * 0.16);
        } else if (lum < 0.35) {
          hsl.l = Math.max(0.34, 0.52 - hsl.l * 0.4);
        } else {
          return null;
        }
        hsl.s = Math.min(hsl.s, 0.28);
        return fromHsl(hsl, Math.max(color.a, 0.5));
      }

      function remember(element, property) {
        var record = entries.get(element);
        if (!record) {
          record = {};
          entries.set(element, record);
        }
        if (!record[property]) {
          record[property] = {
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property)
          };
        }
      }

      function apply(element, property, value) {
        if (!value) return;
        remember(element, property);
        element.style.setProperty(property, value, 'important');
      }

      function restore() {
        entries.forEach(function (record, element) {
          Object.keys(record).forEach(function (property) {
            var original = record[property];
            if (original.value) {
              element.style.setProperty(property, original.value, original.priority);
            } else {
              element.style.removeProperty(property);
            }
          });
        });
        entries.clear();
      }

      function paint() {
        if (currentMode !== 'dark' || !document.body) return;
        var elements = document.body.querySelectorAll('*');
        for (var index = 0; index < elements.length; index += 1) {
          var element = elements[index];
          if (element.closest(MEDIA_SELECTOR)) continue;
          var computed = window.getComputedStyle(element);
          // computed 是实时对象，必须先把原始值全部取出，
          // 否则写入文字颜色会污染后续读取到的 currentColor 边框。
          var background = computed.backgroundColor;
          var text = computed.color;
          var borders = BORDER_SPECS.map(function (spec) {
            if (computed.getPropertyValue(spec.width) === '0px') {
              return null;
            }
            return computed.getPropertyValue(spec.color);
          });

          apply(element, 'background-color', surfaceValue(parseColor(background)));
          apply(element, 'color', textValue(parseColor(text)));
          for (var border = 0; border < BORDER_SPECS.length; border += 1) {
            apply(
              element,
              BORDER_SPECS[border].color,
              borderValue(parseColor(borders[border]))
            );
          }
        }
      }

      function schedule() {
        if (refreshScheduled) return;
        refreshScheduled = true;
        window.requestAnimationFrame(function () {
          refreshScheduled = false;
          paint();
        });
      }

      function setMode(mode) {
        var next = mode === 'dark' ? 'dark' : 'light';
        if (currentMode === next) return;
        currentMode = next;
        restore();
        document.documentElement.setAttribute(ATTR, next);
        if (next === 'dark') schedule();
      }

      window.__storingReaderTheme = {
        set: setMode,
        refresh: schedule,
        current: function () { return currentMode; }
      };

      function boot() {
        var initial = document.documentElement.getAttribute(ATTR) === 'dark' ? 'dark' : 'light';
        currentMode = null;
        setMode(initial);
        window.setTimeout(schedule, 120);
        window.addEventListener('load', schedule);
        // 懒加载或脚本追加的正文片段也要跟上主题，这里只监听节点增删。
        if (window.MutationObserver && document.body) {
          new window.MutationObserver(schedule).observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
    })();
    """#

    static let imageSelectionScript = """
    document.addEventListener('click', (event) => {
      const image = event.target.closest('img');
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      window.webkit?.messageHandlers?.readerImage?.postMessage({
        src: image.currentSrc || image.src || ''
      });
    }, true);
    """

    var dynamicJavaScript: String {
        """
        document.documentElement.style.setProperty('--reader-font-size', '\(Int(font.pointSize))px');
        document.documentElement.style.setProperty('--reader-content-width', '\(contentWidth.cssWidth)');
        if (window.__storingReaderTheme) {
          window.__storingReaderTheme.set('\(themeName)');
        }
        """
    }

    static func applying(
        to html: String,
        font: AppFontPreference,
        contentWidth: ReaderContentWidthPreference,
        colorScheme: ColorScheme = .light
    ) -> String {
        Self(font: font, contentWidth: contentWidth, colorScheme: colorScheme).applying(to: html)
    }

    func applying(to html: String) -> String {
        let head = themeBootstrapScript
            + css
            + "<script>\(Self.readerThemeScript)</script>"
            + "<script>\(Self.imageSelectionScript)</script>"

        guard html.localizedCaseInsensitiveContains("</head>") else {
            return "<!doctype html><html><head>\(head)</head><body>\(html)</body></html>"
        }

        return html.replacingOccurrences(
            of: "</head>",
            with: "\(head)</head>",
            options: .caseInsensitive,
            range: html.range(of: "</head>", options: .caseInsensitive)
        )
    }

    /// 在解析阶段就写入主题，避免深色模式下先闪一帧白底。
    private var themeBootstrapScript: String {
        "<script>document.documentElement.setAttribute('data-storing-reader-theme', '\(themeName)');</script>"
    }
}

@MainActor
final class ReaderWebViewCoordinator: NSObject, WKNavigationDelegate {
    private let onReadingStateChange: @MainActor (Data, String) -> Void
    private let onImageSelected: @MainActor (URL) -> Void
    weak var webView: ReaderWKWebView?

    init(
        onReadingStateChange: @escaping @MainActor (Data, String) -> Void,
        onImageSelected: @escaping @MainActor (URL) -> Void
    ) {
        self.onReadingStateChange = onReadingStateChange
        self.onImageSelected = onImageSelected
    }

    func handleReadingState(_ state: Data, token: String) {
        onReadingStateChange(state, token)
    }

    func didSelectImage(source: String?) {
        guard
            let source,
            let url = URL(string: source),
            ["http", "https", "data"].contains(url.scheme?.lowercased() ?? "")
        else { return }

        onImageSelected(url)
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
        readerWebView.applyPendingDisplayStyle()
        readerWebView.restoreReadingState()
    }
}

@MainActor
final class ReaderImageMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: ReaderWebViewCoordinator?

    init(delegate: ReaderWebViewCoordinator) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "readerImage" else { return }

        let source = (message.body as? [String: Any])?["src"] as? String
        delegate?.didSelectImage(source: source)
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
    private var pendingDisplayStyle: ReaderContentStyle?
    private var appliedStyleToken = ""
    var onReadingStateChange: ((Data, String) -> Void)?
    private var stateCaptureTask: Task<Void, Never>?

    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: NSView.noIntrinsicMetric)
    }

    func loadServerHTML(
        _ html: String,
        baseURL: URL?,
        token: String,
        savedState: Data?
    ) {
        loadServerHTML(
            html,
            baseURL: baseURL,
            token: token,
            savedState: savedState,
            displayStyle: ReaderContentStyle(
                font: .standard,
                contentWidth: .normal
            )
        )
    }

    func loadServerHTML(
        _ html: String,
        baseURL: URL?,
        token: String,
        savedState: Data?,
        displayStyle: ReaderContentStyle
    ) {
        loadedToken = token
        isServerHTMLLoading = true
        pendingReadingState = savedState
        pendingDisplayStyle = displayStyle
        stateCaptureTask?.cancel()
        loadHTMLString(
            displayStyle.applying(to: html),
            baseURL: baseURL
        )
    }

    func apply(_ displayStyle: ReaderContentStyle) {
        guard appliedStyleToken != displayStyle.token else { return }

        appliedStyleToken = displayStyle.token
        evaluateJavaScript(displayStyle.dynamicJavaScript)
    }

    func applyPendingDisplayStyle() {
        guard let displayStyle = pendingDisplayStyle else { return }

        pendingDisplayStyle = nil
        apply(displayStyle)
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
