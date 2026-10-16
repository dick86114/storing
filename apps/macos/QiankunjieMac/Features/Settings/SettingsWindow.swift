import AppKit
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
        SettingsPage {
            WorkspacePanel(
                title: "应用与更新",
                subtitle: "版本、更新源与更新日志。",
                systemImage: "arrow.triangle.2.circlepath"
            ) {
                updateContent
            }

            WorkspacePanel(
                title: "外观与字号",
                subtitle: "跟随系统或固定外观，并调整全局字号。",
                systemImage: "sun.max"
            ) {
                SettingsRow(title: "外观") {
                    AppearanceSettingsView(model: model)
                }

                SettingsRowDivider()

                SettingsRow(title: "字号") {
                    Picker("字号", selection: appFontSelection) {
                        ForEach(AppFontPreference.allCases) { preference in
                            Text(preference.displayName)
                                .tag(preference)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }
            }

            WorkspacePanel(
                title: "采集",
                subtitle: "全局快捷键与微信转发入口。",
                systemImage: "plus.rectangle.on.rectangle"
            ) {
                SettingsRow(title: "全局快捷键", subtitle: "在任意应用里唤起采集窗口。") {
                    Picker("全局采集快捷键", selection: shortcutSelection) {
                        ForEach(GlobalShortcut.allCases) { shortcut in
                            Text(shortcut.displayName)
                                .tag(shortcut)
                        }
                    }
                    .labelsHidden()
                    .fixedSize()
                }

                if let message = shortcutRegistrationMessage ?? menuBarController?.hotKeyRegistrationMessage {
                    Text(message)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(
                            colorScheme == .dark
                                ? QiankunjieColors.darkError
                                : QiankunjieColors.lightError
                        )
                }

                SettingsRowDivider()

                WeChatShareSettingsView()
            }

            accountPanel
        }
    }

    @ViewBuilder
    private var updateContent: some View {
        GitHubStarPromptView()

        SettingsRowDivider()

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

    private var accountPanel: some View {
        WorkspacePanel(
            title: "账号",
            subtitle: isAuthenticated ? "内容与分类偏好跟随当前账号。" : "登录后可同步文章并使用 AI、MCP 等能力。",
            systemImage: "person.crop.circle"
        ) {
            SettingsRow(title: isAuthenticated ? "已登录" : "未登录") {
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
                            Text("退出登录")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.isLoggingOut)
                } else {
                    Button("登录乾坤戒", action: onLogin)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .tint(WorkspacePalette.primary(for: colorScheme))
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

/// 版本区块上方的 GitHub Star 引导；用户关闭后不再打扰。
private struct GitHubStarPromptView: View {
    private static let repositoryURL = URL(string: "https://github.com/dick86114/storing")!
    @AppStorage("settings.githubStarPromptDismissed") private var isDismissed = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if !isDismissed {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: "star.fill")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))

                Text("如果乾坤戒帮到了你，请在 GitHub 点个 Star，这对作者意义重大")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(onContainerColor)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 10)

                Button {
                    NSWorkspace.shared.open(Self.repositoryURL)
                } label: {
                    Label("去点 Star", systemImage: "star.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(QiankunjieColors.accent(for: colorScheme))

                Button {
                    isDismissed = true
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(onContainerColor.opacity(0.72))
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭 GitHub Star 引导")
                .help("关闭 GitHub Star 引导")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(containerColor, in: RoundedRectangle(cornerRadius: 10))
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(QiankunjieColors.accent(for: colorScheme).opacity(0.18))
            }
        }
    }

    private var containerColor: Color {
        colorScheme == .dark
            ? QiankunjieColors.darkAccentContainer
            : QiankunjieColors.lightAccentContainer
    }

    private var onContainerColor: Color {
        colorScheme == .dark
            ? QiankunjieColors.darkOnAccentContainer
            : QiankunjieColors.lightOnAccentContainer
    }
}
