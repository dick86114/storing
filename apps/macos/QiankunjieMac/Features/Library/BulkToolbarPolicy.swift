import QiankunjieLibrary

struct BulkConfirmationCopy: Equatable, Sendable {
    let title: String
    let message: String
    let confirmTitle: String
    let isDestructive: Bool
}

enum BulkToolbarPolicy {
    static func canExit(bulkRunningAction: BulkToolbarAction?) -> Bool {
        bulkRunningAction == nil
    }

    static func menuTitle(for action: BulkToolbarAction) -> String {
        switch action {
        case .exportZIP: "导出 ZIP"
        case .bulkObsidian: "导出 Obsidian"
        default:
            confirmation(for: action, selectedCount: 0).confirmTitle
        }
    }

    static func confirmation(
        for action: BulkToolbarAction,
        selectedCount: Int
    ) -> BulkConfirmationCopy {
        let plural = "\(selectedCount) 篇"

        switch action {
        case .favorite:
            return copy("收藏 \(plural)文章？", "将把 \(plural)文章加入收藏。", "收藏")
        case .unfavorite:
            return copy("取消收藏 \(plural)文章？", "将把 \(plural)文章移出收藏。", "取消收藏")
        case .archive:
            return copy("归档 \(plural)文章？", "将把 \(plural)文章移入归档。", "归档")
        case .unarchive:
            return copy("取消归档 \(plural)文章？", "将把 \(plural)文章移回收件箱。", "取消归档")
        case .delete:
            return destructive("删除 \(plural)文章？", "\(plural)文章会先进入回收站，确认前请再检查选择。", "删除")
        case .permanentDelete:
            return destructive(
                "彻底删除 \(plural)文章？",
                "\(plural)文章不可恢复。共享原文只会在没有其他用户引用时物理删除。",
                "彻底删除"
            )
        case .publish:
            return copy("发布 \(plural)文章？", "确认后 \(plural)文章会通过公开链接访问。", "发布")
        case .unpublish:
            return copy("取消发布 \(plural)文章？", "确认后 \(plural)文章的公开链接将不再可用。", "取消发布")
        case .setCategory:
            return copy("设置分类", "确认后可选择要应用到 \(plural)文章的分类。", "选择分类")
        case .reclassify:
            return copy("重新生成分类？", "将为 \(plural)文章重新执行 AI 分类。", "重新生成")
        case .generateAI:
            return copy("生成 AI 摘要和标签？", "将为 \(plural)文章加入 AI 处理队列。", "生成")
        case .exportZIP:
            return copy("导出 \(plural)文章？", "将生成包含 \(plural)文章内容的 ZIP 压缩包。", "导出")
        case .bulkObsidian:
            return copy("导出到 Obsidian？", "将按当前 Obsidian 目录配置逐篇导出 \(plural)文章。", "导出")
        }
    }

    static func categoryConfirmation(
        category: LibraryCategoryFilter,
        selectedCount: Int
    ) -> BulkConfirmationCopy {
        copy(
            "设置「\(category.name)」",
            "将把 \(selectedCount) 篇文章移动到这个分类。",
            "设置分类"
        )
    }

    private static func copy(
        _ title: String,
        _ message: String,
        _ confirmTitle: String,
        destructive: Bool = false
    ) -> BulkConfirmationCopy {
        BulkConfirmationCopy(
            title: title,
            message: message,
            confirmTitle: confirmTitle,
            isDestructive: destructive
        )
    }

    private static func destructive(
        _ title: String,
        _ message: String,
        _ confirmTitle: String
    ) -> BulkConfirmationCopy {
        copy(title, message, confirmTitle, destructive: true)
    }
}
