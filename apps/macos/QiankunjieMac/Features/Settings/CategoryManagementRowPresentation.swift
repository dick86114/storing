import QiankunjieCore

enum CategoryManagementTrailingControl: Equatable {
    case reorderHandle(systemImage: String)
    case systemLock(systemImage: String)
}

/// 管理页分类行的可见控件与键盘/辅助功能能力，避免视图层自行派生箭头按钮。
struct CategoryManagementRowPresentation: Equatable {
    let trailingControl: CategoryManagementTrailingControl
    let handleAccessibilityLabel: String
    let handleAccessibilityHint: String
    let canMoveUp: Bool
    let canMoveDown: Bool

    static func make(
        category: ArticleCategory,
        categories: [ArticleCategory],
        canReorder: Bool
    ) -> CategoryManagementRowPresentation {
        guard
            !category.isSystem,
            let index = categories.firstIndex(where: { $0.id == category.id })
        else {
            return CategoryManagementRowPresentation(
                trailingControl: .systemLock(systemImage: "lock"),
                handleAccessibilityLabel: "系统分类“\(category.name)”位置固定",
                handleAccessibilityHint: "系统分类不可拖动或调整顺序",
                canMoveUp: false,
                canMoveDown: false
            )
        }

        return CategoryManagementRowPresentation(
            trailingControl: .reorderHandle(systemImage: "line.3.horizontal"),
            handleAccessibilityLabel: "拖动排序“\(category.name)”",
            handleAccessibilityHint: "拖动调整顺序；聚焦后可使用上下方向键移动",
            canMoveUp: canReorder && hasUserCategory(at: index - 1, in: categories),
            canMoveDown: canReorder && hasUserCategory(at: index + 1, in: categories)
        )
    }

    private static func hasUserCategory(at index: Int, in categories: [ArticleCategory]) -> Bool {
        guard categories.indices.contains(index) else { return false }
        return !categories[index].isSystem
    }
}
