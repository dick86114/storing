import SwiftUI

struct SettingsView: View {
    @Bindable var model: AppModel
    let menuBarController: MenuBarController?
    let onLogin: () -> Void
    let updateCheckRequestID: Int

    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            SettingsWindow(
                model: model.settingsModel,
                shortcutSettings: model.shortcutSettings,
                menuBarController: menuBarController,
                isAuthenticated: model.isAuthenticated,
                onLogin: onLogin,
                updateCheckRequestID: updateCheckRequestID
            )
            .navigationDestination(for: SettingsTool.self) { tool in
                destination(for: tool)
            }
        }
    }

    @ViewBuilder
    private func destination(for tool: SettingsTool) -> some View {
        let client = ManagementAPIClient(repository: model.authModel.repository)
        switch tool {
        case .aiModel:
            AiSettingsView(repository: model.authModel.repository)
        case .myMCP:
            MCPManagementView(scope: .personal, client: client)
        case .categories:
            CategoryManagementView(client: client)
        case .resetPassword:
            ResetPasswordView(client: client)
        }
    }
}
