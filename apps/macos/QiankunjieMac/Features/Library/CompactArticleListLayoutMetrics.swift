import CoreGraphics

enum ArticleListPresentationMode: String, CaseIterable, Identifiable, Sendable {
    case compactList
    case card

    var id: String { rawValue }

    var title: String {
        switch self {
        case .compactList: "列表"
        case .card: "卡片"
        }
    }

    var systemImage: String {
        switch self {
        case .compactList: "list.bullet.rectangle"
        case .card: "rectangle.grid.1x2"
        }
    }
}

struct CompactArticleListLayoutMetrics: Equatable, Sendable {
    let rowHeight: CGFloat
    let rowCoverSize: CGFloat
    let rowCoverAspectRatio: CGFloat
    let cardCoverAspectRatio: CGFloat

    init() {
        self.rowHeight = 132
        // 左右布局用内嵌方形封面，卡片视图保留微信公众号头条封面比例。
        self.rowCoverSize = 104
        self.rowCoverAspectRatio = 1
        self.cardCoverAspectRatio = 2.35
    }

    func visibleTags(_ tags: [String]) -> [CompactArticleTagDisplay] {
        tags.map { tag in
            CompactArticleTagDisplay(
                id: tag,
                text: tag
            )
        }
    }
}

struct CompactArticleTagDisplay: Identifiable, Equatable, Sendable {
    let id: String
    let text: String
}
