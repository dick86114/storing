import QiankunjieAuth
import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationWillFinishLaunching(_ notification: Notification) {
        NSWindow.allowsAutomaticWindowTabbing = false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppInteractionCoordinator.shared.start()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowWillClose(_:)),
            name: NSWindow.willCloseNotification,
            object: nil
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        AppInteractionCoordinator.shared.stop()
        NotificationCenter.default.removeObserver(self)
    }

    static func shouldHideDock(
        afterClosing window: NSWindow,
        otherVisibleWindows: [NSWindow]
    ) -> Bool {
        guard !(window is NSPanel) else { return false }
        return otherVisibleWindows.allSatisfy { $0 is NSPanel || isStatusBarWindow($0) }
    }

    /// 菜单栏图标自身会长期保留一个可见的 `NSStatusBarWindow`，它既不是普通窗口也不是
    /// `NSPanel`。不把它排除掉，关闭主窗口后 Dock 图标永远不会隐藏。
    private static func isStatusBarWindow(_ window: NSWindow) -> Bool {
        window.className == "NSStatusBarWindow"
    }

    @objc private func windowWillClose(_ notification: Notification) {
        MainActor.assumeIsolated {
            guard let window = notification.object as? NSWindow else { return }
            let otherVisibleWindows = NSApp.windows.filter {
                $0 !== window && $0.isVisible
            }
            if Self.shouldHideDock(
                afterClosing: window,
                otherVisibleWindows: otherVisibleWindows
            ) {
                NSApp.setActivationPolicy(.accessory)
            }
        }
    }
}

@main
struct QiankunjieMacApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model: AppModel?
    @State private var menuBarController: MenuBarController?
    #if DEBUG
    @State private var uiLabScenario = UILabScenario.fromCommandLine()
    #endif

    init() {
        #if DEBUG
        let launchScenario = UILabScenario.fromCommandLine()
        _uiLabScenario = State(initialValue: launchScenario)

        if launchScenario == nil {
            _model = State(initialValue: AppModel())
        }
        #else
            _model = State(initialValue: AppModel())
        #endif
    }

    var body: some Scene {
        Window(QiankunjieMacMetadata.displayName, id: "main") {
            mainContent
                // 标题由根视图内容列的工具栏项提供，这里不再设置 navigationTitle。
        }

        Window("关于 \(QiankunjieMacMetadata.displayName)", id: "about") {
            AboutView()
                .preferredColorScheme(model?.settingsModel.resolvedColorScheme)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
        .restorationBehavior(.disabled)

        // 应用菜单（左上角）参考系统应用：关于 / 设置 / 检查更新 / 退出登录。
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("关于 \(QiankunjieMacMetadata.displayName)") {
                    menuBarController?.performShowAbout()
                }
            }

            CommandGroup(replacing: .appSettings) {
                Button("设置") {
                    menuBarController?.performOpenSettings()
                }
                .keyboardShortcut(",", modifiers: .command)
            }

            CommandGroup(after: .appSettings) {
                Button("检查更新…") {
                    menuBarController?.performCheckForUpdates()
                }

                Button("退出登录") {
                    guard let model else { return }
                    Task {
                        await model.settingsModel.logout()
                    }
                }
                .disabled(model?.user == nil)
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        #if DEBUG
        if let uiLabScenario {
            UILabRootView(scenario: uiLabScenario)
        } else if let model {
            productionContent(model: model)
        }
        #else
        if let model {
            productionContent(model: model)
        }
        #endif
    }

    private func productionContent(model: AppModel) -> some View {
        RootWindow(
            model: model,
            menuBarController: $menuBarController
        )
        .environment(model)
        .environment(model.settingsModel)
        // 清空系统标题，窗口顶部只保留带版本号的自定义标题。
        .navigationTitle("")
        .task {
            await model.start()
        }
    }

}
