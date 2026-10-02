import QiankunjieCollect
import QiankunjieNetworking
import QiankunjieUpdating
import SwiftUI

struct SettingsWindow: View {
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
        Form {
            Section("应用与更新") {
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
            appearanceSection
            shortcutSection
            weChatShareSection
            if isAuthenticated {
                accountToolsSection
            } else {
                Section("账号") {
                    LabeledContent("当前状态", value: "未登录")
                    Button {
                        onLogin()
                    } label: {
                        Label("登录乾坤戒", systemImage: "person.badge.key")
                    }
                }
            }
            accountSection
        }
        .formStyle(.grouped)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WorkspacePalette.pageBackground(for: colorScheme))
        .navigationTitle("设置")
    }

    private var appearanceSection: some View {
        Section("外观") {
            AppearanceSettingsView(model: model)
            Picker("字号", selection: appFontSelection) {
                ForEach(AppFontPreference.allCases) { preference in
                    Text(preference.displayName)
                        .tag(preference)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var appFontSelection: Binding<AppFontPreference> {
        Binding(
            get: { model.appFont },
            set: { model.setAppFont($0) }
        )
    }

    private var shortcutSection: some View {
        Section("全局采集快捷键") {
            Picker("全局采集快捷键", selection: shortcutSelection) {
                ForEach(GlobalShortcut.allCases) { shortcut in
                    Text(shortcut.displayName)
                        .tag(shortcut)
                }
            }
            .onChange(of: shortcutSettings.shortcut) {
                _, newValue in
                menuBarController?.updateShortcut(newValue)
            }
            if let message = shortcutRegistrationMessage ?? menuBarController?.hotKeyRegistrationMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var weChatShareSection: some View {
        Section("微信转发") {
            WeChatShareSettingsView()
        }
    }

    private var accountSection: some View {
        Section {
            if isAuthenticated {
                Button {
                    Task {
                        await model.logout()
                    }
                } label: {
                    if model.isLoggingOut {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("正在退出登录")
                        }
                    } else {
                        Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
                .disabled(model.isLoggingOut)
            }
        }
    }

    private var accountToolsSection: some View {
        Section("账户与工具") {
            ForEach(SettingsTool.allCases) { tool in
                NavigationLink(value: tool) {
                    Label(tool.title, systemImage: tool.systemImage)
                }
            }
        }
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
