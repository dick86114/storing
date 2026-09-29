import QiankunjieAuth
import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}

@main
struct QiankunjieMacApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()
    @State private var menuBarController: MenuBarController?

    var body: some Scene {
        WindowGroup(id: "main") {
            RootWindow(
                model: model,
                menuBarController: $menuBarController
            )
                .environment(model)
                .navigationTitle(QiankunjieMacMetadata.displayName)
                .task {
                    await model.start()
                }
        }
    }
}
