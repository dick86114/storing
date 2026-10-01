import AppKit
import SwiftUI

/// 首次打开主窗口时把窗口放大到默认尺寸。
///
/// SwiftUI 的 `WindowGroup.defaultSize` 在 macOS 上会被内容理想尺寸覆盖，
/// 实测不生效，因此这里在窗口出现时直接用 AppKit 调整一次；
/// 用户之后手动调整的窗口尺寸仍由系统记住，不会每次都被重置。
struct MainWindowSizer: NSViewRepresentable {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        DispatchQueue.main.async {
            guard let window = view.window else { return }
            Self.applyIfNeeded(to: window, defaults: defaults)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}

    @MainActor
    static func applyIfNeeded(to window: NSWindow, defaults: UserDefaults) {
        let isApplied = defaults.bool(forKey: MainWindowMetrics.defaultSizeAppliedKey)
        guard MainWindowMetrics.shouldApplyDefaultSize(
            isApplied: isApplied,
            currentFrameSize: window.frame.size
        ) else { return }
        guard let screen = window.screen ?? NSScreen.main else { return }

        defaults.set(true, forKey: MainWindowMetrics.defaultSizeAppliedKey)

        let target = MainWindowMetrics.resolvedSize(forVisibleFrame: screen.visibleFrame.size)
        var frame = window.frame
        frame.size = target
        window.setFrame(frame, display: true)
        window.center()
    }
}
