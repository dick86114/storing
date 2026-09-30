import SwiftUI

struct SettingsView: View {
    @Bindable var model: AppModel
    let menuBarController: MenuBarController?
    let onLogin: () -> Void

    var body: some View {
        SettingsWindow(
            model: model.settingsModel,
            shortcutSettings: model.shortcutSettings,
            menuBarController: menuBarController,
            isAuthenticated: model.isAuthenticated,
            onLogin: onLogin
        )
    }
}
