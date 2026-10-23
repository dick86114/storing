import QiankunjieCore

/// 快速创建的两个成功出口；只有真正新建分类才允许展示“已创建”提醒。
enum CategoryQuickCreateResult: Equatable {
    case created(ArticleCategory)
    case reusedExisting(ArticleCategory)

    var category: ArticleCategory {
        switch self {
        case .created(let category), .reusedExisting(let category):
            category
        }
    }

    var creationNotice: String? {
        switch self {
        case .created(let category):
            "分类「\(category.name)」已创建"
        case .reusedExisting:
            nil
        }
    }

    var navigationFailureMessage: String {
        switch self {
        case .created:
            "分类已创建，但无法进入该分类，请稍后重试"
        case .reusedExisting:
            "无法进入所选分类，请稍后重试"
        }
    }
}
