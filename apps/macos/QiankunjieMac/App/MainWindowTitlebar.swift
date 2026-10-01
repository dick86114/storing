import AppKit
import SwiftUI

/// 把「乾坤戒 v版本号」固定到标题栏左侧。
///
/// macOS 26 会给工具栏项目附加胶囊玻璃背景，即使用左侧导航位也一样。
/// 这里改用 AppKit 的标题栏附件视图，绕开工具栏样式：位置仍在标题栏内、
/// 不占用内容区高度，同时没有任何背景装饰。
struct MainWindowTitlebar: NSViewRepresentable {
    let title: String
    let version: String

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        DispatchQueue.main.async {
            guard let window = view.window else { return }
            Self.install(on: window, title: title, version: version)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard let window = nsView.window else { return }
        Self.install(on: window, title: title, version: version)
    }

    @MainActor
    private static func install(on window: NSWindow, title: String, version: String) {
        let identifier = NSUserInterfaceItemIdentifier("qiankunjie.main-window-titlebar")
        guard !window.titlebarAccessoryViewControllers.contains(where: { $0.identifier == identifier }) else {
            return
        }

        let controller = NSTitlebarAccessoryViewController()
        controller.identifier = identifier
        controller.layoutAttribute = .left
        let hosting = NSHostingView(
            rootView: MainWindowTitleView(title: title, version: version)
        )
        hosting.frame = NSRect(x: 0, y: 0, width: 200, height: 24)
        hosting.autoresizingMask = [.width, .height]
        controller.view = hosting
        controller.fullScreenMinHeight = 0
        window.addTitlebarAccessoryViewController(controller)
    }
}

private struct MainWindowTitleView: View {
    let title: String
    let version: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(title)
                .font(.headline)
            Text(version)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.trailing, 8)
    }
}
