import CoreGraphics

struct CompactArticleListLayoutMetrics: Equatable, Sendable {
    let rowHeight: CGFloat
    let coverSize: CGFloat
    let maximumTextWidth: CGFloat
    let maximumTagWidth: CGFloat
    let maximumTagCharacters: Int

    init(centerWidth: CGFloat) {
        let listHorizontalPadding: CGFloat = 24
        let rowHorizontalPadding: CGFloat = 20
        let coverSpacing: CGFloat = 10
        let tagSpacing: CGFloat = 10

        self.rowHeight = 132
        self.coverSize = 56
        self.maximumTextWidth = centerWidth
            - listHorizontalPadding
            - rowHorizontalPadding
            - coverSize
            - coverSpacing
        self.maximumTagWidth = (maximumTextWidth - tagSpacing) / 3
        self.maximumTagCharacters = 12
    }

    func displayTags(_ tags: [String]) -> [String] {
        tags.prefix(3).map(truncatedTag)
    }

    private func truncatedTag(_ tag: String) -> String {
        guard tag.count > maximumTagCharacters else {
            return tag
        }
        return String(tag.prefix(maximumTagCharacters - 1)) + "…"
    }
}
