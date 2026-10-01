import CoreGraphics

enum AppShellLayout: Equatable, Sendable {
    case threeColumns
    case listDetail(isReaderPrimary: Bool)
    case settings
}

struct AppShellLayoutPolicy: Sendable {
    let threeColumnMinimumWidth: CGFloat

    init(threeColumnMinimumWidth: CGFloat = 900) {
        self.threeColumnMinimumWidth = threeColumnMinimumWidth
    }

    func layout(
        availableWidth: CGFloat,
        selectedArticleID: Int?,
        destination: AppDestination = .published
    ) -> AppShellLayout {
        if destination == .settings || destination == .admin {
            return .settings
        }

        guard availableWidth >= threeColumnMinimumWidth else {
            return .listDetail(isReaderPrimary: selectedArticleID != nil)
        }
        return .threeColumns
    }
}
