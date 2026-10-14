import QiankunjieCore

/// 批量动作在菜单里的分组：不同组之间用分隔线隔开，删除类永远放最后。
public enum BulkActionGroup: String, CaseIterable, Sendable {
    /// 收藏与归档。
    case organize
    /// 分类与 AI 处理。
    case categorize
    /// 发布与导出。
    case publish
    /// 删除类，具有破坏性。
    case destructive

    var actions: [BulkToolbarAction] {
        switch self {
        case .organize:
            [.favorite, .unfavorite, .archive, .unarchive]
        case .categorize:
            [.setCategory, .reclassify, .generateAI]
        case .publish:
            [.publish, .unpublish, .exportZIP, .bulkObsidian]
        case .destructive:
            [.delete, .permanentDelete]
        }
    }
}

public enum BulkArticlePolicy {
    public static let maximumCount = 200

    /// 各视图可用的批量动作，按「整理 → 分类与 AI → 发布与导出 → 删除」排序。
    public static func toolbarActions(for view: LibraryView) -> [BulkToolbarAction] {
        actionGroups(for: view).flatMap { actions(in: $0, for: view) }
    }

    /// 当前视图下实际可用的动作分组（空分组不返回）。
    public static func actionGroups(for view: LibraryView) -> [BulkActionGroup] {
        availableActions(for: view).isEmpty ? [] : BulkActionGroup.allCases.filter { group in
            group.actions.contains { availableActions(for: view).contains($0) }
        }
    }

    /// 取某分组里当前视图可用的动作，顺序与分组定义一致。
    public static func actions(
        in group: BulkActionGroup,
        for view: LibraryView
    ) -> [BulkToolbarAction] {
        let available = availableActions(for: view)
        return group.actions.filter { available.contains($0) }
    }

    public static func validatedIDs(_ ids: [Int]) throws -> [Int] {
        try ids.forEach { id in
            guard id > 0 else {
                throw AppError.invalidInput
            }
        }
        let uniqueIDs = Array(Set(ids)).sorted()
        guard uniqueIDs.count <= maximumCount else {
            throw AppError.invalidInput
        }
        return uniqueIDs
    }

    private static func availableActions(for view: LibraryView) -> [BulkToolbarAction] {
        switch view {
        case .inbox:
            [.favorite, .archive, .generateAI, .publish, .exportZIP, .bulkObsidian, .delete, .permanentDelete]
        case .favorites:
            [.unfavorite, .archive, .generateAI, .publish, .exportZIP, .bulkObsidian, .delete, .permanentDelete]
        case .archive:
            [
                .favorite, .unfavorite, .unarchive, .setCategory, .reclassify, .generateAI,
                .publish, .unpublish, .exportZIP, .bulkObsidian, .delete, .permanentDelete,
            ]
        case .published:
            [.unpublish, .exportZIP, .bulkObsidian, .delete, .permanentDelete]
        }
    }
}
