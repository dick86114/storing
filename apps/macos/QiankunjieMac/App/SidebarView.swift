import QiankunjieDesignSystem
import SwiftUI

struct SidebarView: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        List(selection: $model.destination) {
            Section("资料库") {
                ForEach(AppDestination.allCases, id: \.self) { destination in
                    Label(destination.title, systemImage: destination.systemImage)
                        .tag(destination)
                }
            }
        }
        .listStyle(.sidebar)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
        .safeAreaInset(edge: .bottom) {
            if let user = model.user {
                Text(user.username)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(QiankunjieColors.surface(for: colorScheme))
            }
        }
    }
}
