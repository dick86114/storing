import QiankunjieCollect
import QiankunjieNetworking
import QiankunjieUpdating
import SwiftUI

struct SettingsWindow: View {
    @Bindable var model: SettingsModel
    @Bindable var shortcutSettings: GlobalShortcutSettings
    let menuBarController: MenuBarController?
    private let updateService: (any UpdateServicing)?
    private let updateDefaults: UserDefaults
    @State private var shortcutRegistrationMessage: String?

    init(
        model: SettingsModel,
        shortcutSettings: GlobalShortcutSettings,
        menuBarController: MenuBarController?,
        updateService: (any UpdateServicing)? = nil,
        updateDefaults: UserDefaults = .standard
    ) {
        self.model = model
        self.shortcutSettings = shortcutSettings
        self.menuBarController = menuBarController
        self.updateService = updateService
        self.updateDefaults = updateDefaults
        _shortcutRegistrationMessage = State(initialValue: nil)
    }

    var body: some View {
        Form {
            applicationSection
            Section("软件更新") {
                if let updateService {
                    UpdateSettingsView(
                        currentVersion: QiankunjieMacMetadata.appVersion,
                        service: updateService,
                        defaults: updateDefaults
                    )
                } else {
                    UpdateSettingsView()
                }
            }
            appearanceSection
            shortcutSection
            DeviceSessionsView(model: model)
            accountSection
        }
        .formStyle(.grouped)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("设置")
        .task {
            await model.loadSessions()
        }
    }

    private var applicationSection: some View {
        Section("应用信息") {
            LabeledContent("版本", value: QiankunjieMacMetadata.appVersion)
            LabeledContent("服务地址", value: model.serviceAddress)
            LabeledContent("环境", value: model.environmentName)
        }
    }

    private var appearanceSection: some View {
        Section("外观") {
            AppearanceSettingsView(model: model)
        }
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

    private var accountSection: some View {
        Section {
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
