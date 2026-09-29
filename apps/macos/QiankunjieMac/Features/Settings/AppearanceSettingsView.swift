import QiankunjieAuth
import SwiftUI

struct AppearanceSettingsView: View {
    @Bindable var model: SettingsModel

    var body: some View {
        Picker("外观", selection: appearanceSelection) {
            ForEach(AppearancePreference.allCases) { preference in
                Text(preference.displayName)
                    .tag(preference)
            }
        }
        .pickerStyle(.segmented)
    }

    private var appearanceSelection: Binding<AppearancePreference> {
        Binding(
            get: { model.appearance },
            set: { model.setAppearance($0) }
        )
    }
}
