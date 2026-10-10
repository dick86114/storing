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
    let coverSize: CGFloat
    let coverAspectRatio: CGFloat
    let coverWidth: CGFloat

    init() {
        self.rowHeight = 132
        self.coverSize = 104
        self.coverAspectRatio = 1
        self.coverWidth = 104
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
