import QiankunjieCollect
import QiankunjieDesignSystem
import QiankunjieUpdating
import SwiftUI

/// 设置页「通用」面板。
/// 页面级左右菜单由 SettingsView 提供，这里只负责右侧卡片内容。
struct SettingsGeneralView: View {
    @Bindable var model: SettingsModel
    @Bindable var shortcutSettings: GlobalShortcutSettings
    let menuBarController: MenuBarController?
    let isAuthenticated: Bool
    let onLogin: () -> Void
    let updateCheckRequestID: Int
    private let updateService: (any UpdateServicing)?
    private let updateDefaults: UserDefaults
    @State private var shortcutRegistrationMessage: String?
    @Environment(\.colorScheme) private var colorScheme

    init(
        model: SettingsModel,
        shortcutSettings: GlobalShortcutSettings,
        menuBarController: MenuBarController?,
        isAuthenticated: Bool,
        onLogin: @escaping () -> Void,
        updateCheckRequestID: Int = 0,
        updateService: (any UpdateServicing)? = nil,
        updateDefaults: UserDefaults = .standard
    ) {
        self.model = model
        self.shortcutSettings = shortcutSettings
        self.menuBarController = menuBarController
        self.isAuthenticated = isAuthenticated
        self.onLogin = onLogin
        self.updateCheckRequestID = updateCheckRequestID
        self.updateService = updateService
        self.updateDefaults = updateDefaults
        _shortcutRegistrationMessage = State(initialValue: nil)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                WorkspacePanel(
                    title: "应用与更新",
                    subtitle: "检查版本、阅读更新日志并选择下载源。",
                    systemImage: "arrow.triangle.2.circlepath"
                ) {
                    updateContent
                }

                WorkspacePanel(
                    title: "外观",
                    subtitle: "跟随系统或固定应用外观，并调整全局字号。",
                    systemImage: "sun.max"
                ) {
                    appearanceContent
                }

                WorkspacePanel(
                    title: "采集",
                    subtitle: "配置全局快捷键和微信转发入口。",
                    systemImage: "plus.rectangle.on.rectangle"
                ) {
                    collectContent
                }

                accountPanel
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(QiankunjieColors.background(for: colorScheme))
    }

    @ViewBuilder
    private var updateContent: some View {
        if let updateService {
            UpdateSettingsView(
                currentVersion: QiankunjieMacMetadata.appVersion,
                service: updateService,
                defaults: updateDefaults,
                updateCheckRequestID: updateCheckRequestID
            )
        } else {
            UpdateSettingsView(updateCheckRequestID: updateCheckRequestID)
        }
    }

    private var appearanceContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 18) {
                settingLabel("外观")
                Spacer(minLength: 12)
                AppearanceSettingsView(model: model)
                    .frame(width: 360)
            }

            Divider()

            HStack(alignment: .center, spacing: 18) {
                settingLabel("字号")
                Spacer(minLength: 12)
                Picker("字号", selection: appFontSelection) {
                    ForEach(AppFontPreference.allCases) { preference in
                        Text(preference.displayName)
                            .tag(preference)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 360)
            }
        }
    }

    private var collectContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 18) {
                settingLabel("全局快捷键")
                Spacer(minLength: 12)
                Picker("全局采集快捷键", selection: shortcutSelection) {
                    ForEach(GlobalShortcut.allCases) { shortcut in
                        Text(shortcut.displayName)
                            .tag(shortcut)
                    }
                }
                .frame(width: 220)
            }

            if let message = shortcutRegistrationMessage ?? menuBarController?.hotKeyRegistrationMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Divider()
            WeChatShareSettingsView()
        }
    }

    private var accountPanel: some View {
        WorkspacePanel(
            title: "账号",
            subtitle: isAuthenticated ? "查看登录状态或退出当前账号。" : "登录后可以同步文章和使用个性化配置。",
            systemImage: "person.crop.circle"
        ) {
            HStack(alignment: .center, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(isAuthenticated ? "已登录" : "未登录")
                        .font(.callout.weight(.medium))
                    Text(isAuthenticated ? "内容、分类偏好和 MCP 连接会跟随当前账号。" : "登录后才能使用 AI 配置、MCP 和密码管理。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }

                Spacer(minLength: 12)

                if isAuthenticated {
                    Button {
                        Task {
                            await model.logout()
                        }
                    } label: {
                        if model.isLoggingOut {
                            HStack(spacing: 6) {
                                ProgressView()
                                    .controlSize(.small)
                                Text("正在退出")
                            }
                        } else {
                            Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isLoggingOut)
                } else {
                    Button("登录乾坤戒", action: onLogin)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .tint(WorkspacePalette.primary(for: colorScheme))
    }

    private func settingLabel(_ title: String) -> some View {
        Text(title)
            .font(.callout.weight(.medium))
            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
    }

    private var appFontSelection: Binding<AppFontPreference> {
        Binding(
            get: { model.appFont },
            set: { model.setAppFont($0) }
        )
    }

    private var shortcutSelection: Binding<GlobalShortcut> {
        Binding(
            get: { shortcutSettings.shortcut },
            set: { newValue in
                if shortcutSettings.select(newValue, register: { shortcut in
                    menuBarController?.updateShortcut(shortcut) ?? true
                }) {
                    shortcutRegistrationMessage = nil
                } else {
                    shortcutRegistrationMessage = shortcutSettings.registrationMessage
                }
            }
        )
    }
}
