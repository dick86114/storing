import QiankunjieCollect
import SwiftUI

struct SettingsView: View {
    @Bindable var model: AppModel
    let menuBarController: MenuBarController?

    var body: some View {
        Form {
            Picker(
                "全局采集快捷键",
                selection: shortcutSelection
            ) {
                ForEach(GlobalShortcut.allCases) { shortcut in
                    Text(shortcut.displayName)
                        .tag(shortcut)
                }
            }
            .onChange(of: model.shortcutSettings.shortcut) {
                _, newValue in
                menuBarController?.updateShortcut(newValue)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("设置")
    }

    private var shortcutSelection: Binding<GlobalShortcut> {
        Binding(
            get: { model.shortcutSettings.shortcut },
            set: { newValue in
                model.shortcutSettings.select(newValue)
            }
        )
    }
}
