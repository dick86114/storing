import CoreGraphics

enum AppShellLayout: Equatable, Sendable {
    case threeColumns
    case listDetail(isReaderPrimary: Bool)
}

struct AppShellLayoutPolicy: Sendable {
    let threeColumnMinimumWidth: CGFloat

    init(threeColumnMinimumWidth: CGFloat = 900) {
        self.threeColumnMinimumWidth = threeColumnMinimumWidth
    }

    func layout(
        availableWidth: CGFloat,
        selectedArticleID: Int?
    ) -> AppShellLayout {
        guard availableWidth >= threeColumnMinimumWidth else {
            return .listDetail(isReaderPrimary: selectedArticleID != nil)
        }
        return .threeColumns
    }
}
