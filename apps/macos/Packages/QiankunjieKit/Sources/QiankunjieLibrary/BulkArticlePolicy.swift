import QiankunjieCore

public enum BulkArticlePolicy {
    public static let maximumCount = 200

    public static func toolbarActions(for view: LibraryView) -> [BulkToolbarAction] {
        switch view {
        case .inbox:
            [.favorite, .archive, .delete, .permanentDelete, .generateAI, .publish, .exportZIP, .bulkObsidian]
        case .favorites:
            [.unfavorite, .archive, .delete, .permanentDelete, .generateAI, .publish, .exportZIP, .bulkObsidian]
        case .archive:
            [
                .favorite, .unfavorite, .unarchive, .setCategory, .reclassify, .generateAI,
                .delete, .permanentDelete, .publish, .unpublish, .exportZIP, .bulkObsidian,
            ]
        case .published:
            [.unpublish, .delete, .permanentDelete, .exportZIP, .bulkObsidian]
        }
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
}
