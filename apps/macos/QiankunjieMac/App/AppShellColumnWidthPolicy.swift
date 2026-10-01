import CoreGraphics

/// 为原生 NavigationSplitView 提供中栏的初始和最小宽度。
struct AppShellColumnWidthPolicy: Sendable {
    let defaultContentWidth: CGFloat
    let minimumContentWidth: CGFloat
    let threeColumnChromeWidth: CGFloat

    init(
        defaultContentWidth: CGFloat = 620,
        minimumContentWidth: CGFloat = 340,
        threeColumnChromeWidth: CGFloat = 320
    ) {
        self.defaultContentWidth = defaultContentWidth
        self.minimumContentWidth = minimumContentWidth
        self.threeColumnChromeWidth = threeColumnChromeWidth
    }

    func contentColumnWidth(
        availableWidth: CGFloat
    ) -> (minimum: CGFloat, ideal: CGFloat) {
        let availableContentWidth = availableWidth - threeColumnChromeWidth

        return (
            minimum: minimumContentWidth,
            ideal: min(
                defaultContentWidth,
                max(minimumContentWidth, availableContentWidth)
            )
        )
    }
}
