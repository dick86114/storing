import QiankunjieAuth
import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowWillClose(_:)),
            name: NSWindow.willCloseNotification,
            object: nil
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        NotificationCenter.default.removeObserver(self)
    }

    static func shouldHideDock(
        afterClosing window: NSWindow,
        otherVisibleWindows: [NSWindow]
    ) -> Bool {
        guard !(window is NSPanel) else { return false }
        return otherVisibleWindows.allSatisfy { $0 is NSPanel }
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
        WindowGroup(id: "main") {
            mainContent
                .navigationTitle(QiankunjieMacMetadata.displayName)
                .navigationSubtitle("v" + QiankunjieMacMetadata.appVersion)
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
        .task {
            await model.start()
        }
    }
}
