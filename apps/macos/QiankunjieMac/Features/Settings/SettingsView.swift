import QiankunjieAuth
import QiankunjieDesignSystem
import QiankunjieNetworking
import SwiftUI

struct SettingsView: View {
    @Bindable var model: AppModel
    let menuBarController: MenuBarController?
    let onLogin: () -> Void
    let updateCheckRequestID: Int
    @State private var selectedTool: SettingsTool = .general
    @Environment(\.colorScheme) private var colorScheme

    init(
        model: AppModel,
        menuBarController: MenuBarController?,
        onLogin: @escaping () -> Void,
        updateCheckRequestID: Int
    ) {
        self.model = model
        self.menuBarController = menuBarController
        self.onLogin = onLogin
        self.updateCheckRequestID = updateCheckRequestID
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            HStack(spacing: 0) {
                WorkspaceSidebar(
                    sectionTitle: "设置项",
                    items: SettingsTool.allCases.map { tool in
                        WorkspaceSidebarItem(
                            id: tool,
                            title: tool.title,
                            systemImage: tool.systemImage,
                            subtitle: tool.subtitle
                        )
                    },
                    selection: $selectedTool
                )

                Divider()

                selectedPanel
            }
        }
        .frame(minWidth: 880, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("设置")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                Text("集中管理应用偏好、AI 能力、账号连接和安全设置。")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 0)
        }
        .padding(20)
    }

    @ViewBuilder
    private var selectedPanel: some View {
        Group {
            switch selectedTool {
            case .general:
                SettingsGeneralView(
                    model: model.settingsModel,
                    shortcutSettings: model.shortcutSettings,
                    menuBarController: menuBarController,
                    isAuthenticated: model.isAuthenticated,
                    onLogin: onLogin,
                    updateCheckRequestID: updateCheckRequestID
                )
            case .aiModel:
                if model.isAuthenticated {
                    AiSettingsView(repository: model.authModel.repository)
                } else {
                    SettingsLoginRequiredView(title: "AI 模型", message: "登录后可以按账号配置模型与自动生成策略。", onLogin: onLogin)
                }
            case .myMCP:
                if model.isAuthenticated {
                    MCPManagementView(
                        scope: .personal,
                        client: ManagementAPIClient(repository: model.authModel.repository),
                        presentation: .embedded
                    )
                } else {
                    SettingsLoginRequiredView(title: "我的 MCP", message: "登录后可以创建和管理你的 MCP 连接。", onLogin: onLogin)
                }
            case .resetPassword:
                if model.isAuthenticated {
                    ResetPasswordView(client: ManagementAPIClient(repository: model.authModel.repository))
                } else {
                    SettingsLoginRequiredView(title: "重置密码", message: "登录后可以更换账号密码。", onLogin: onLogin)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QiankunjieColors.background(for: colorScheme))
    }
}

private struct SettingsLoginRequiredView: View {
    let title: String
    let message: String
    let onLogin: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "lock.rotation")
                .font(.system(size: 30))
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            VStack(spacing: 6) {
                Text("登录后使用\(title)")
                    .font(.headline)
                Text(message)
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .multilineTextAlignment(.center)
            }
            Button("登录乾坤戒", action: onLogin)
                .buttonStyle(.borderedProminent)
                .tint(WorkspacePalette.primary(for: colorScheme))
        }
        .padding(28)
        .frame(maxWidth: 460)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
