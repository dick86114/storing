import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct BulkCategoryRequest: Identifiable {
    let purpose: BulkCategoryPurpose
    let targetArticleID: Int?

    var id: String {
        "\(purpose.rawValue)-\(targetArticleID.map(String.init) ?? "bulk")"
    }
}

enum BulkCategoryPurpose: String, Identifiable {
    case archive
    case setCategory

    var id: String { rawValue }

    var title: String {
        switch self {
        case .archive: "归档到哪里？"
        case .setCategory: "批量修改分类"
        }
    }

    var singleTargetTitle: String {
        switch self {
        case .archive: title
        case .setCategory: "修改分类"
        }
    }

    var subtitle: String {
        switch self {
        case .archive: "分类只用于归档文章。选择分类后，文章会移入「归档」；也可以让 AI 判断。"
        case .setCategory: "选择预设分类，或让 AI 重新判断。"
        }
    }
}

enum BulkCategoryOperation: Sendable {
    case manual
    case ai
}

enum BulkCategoryOutcomeMapper {
    static func outcome(
        result: NativeBulkResult?,
        error: AppError?,
        operation: BulkCategoryOperation
    ) -> CategoryAssignmentOutcome {
        let message = result?.issues.compactMap(\.message).first

        if let error {
            switch error {
            case .contentUnavailable:
                switch operation {
                case .manual:
                    return .categoryUnavailable(
                        message: normalized(message, fallback: "分类已失效，请刷新后重试")
                    )
                case .ai:
                    return .contentUnavailable(
                        message: normalized(message, fallback: "请求的文章不可用")
                    )
                }
            default:
                return .failure(
                    message: normalized(message, fallback: "分类失败，请稍后重试")
                )
            }
        }

        guard let result else {
            return .failure(message: "分类失败，请稍后重试")
        }

        let failedCount = max(0, result.issues.count - result.skippedCount)
        guard failedCount > 0 else {
            return .success(
                succeededCount: result.succeededCount,
                skippedCount: result.skippedCount
            )
        }

        let summary = summary(for: result, failedCount: failedCount)
        guard result.succeededCount > 0 else {
            return .failure(message: summary)
        }
        return .partial(
            succeededCount: result.succeededCount,
            skippedCount: result.skippedCount,
            failedCount: failedCount,
            message: summary
        )
    }

    private static func normalized(_ message: String?, fallback: String) -> String {
        guard let message = message?.trimmingCharacters(in: .whitespacesAndNewlines),
              !message.isEmpty
        else {
            return fallback
        }
        return message
    }

    private static func summary(
        for result: NativeBulkResult,
        failedCount: Int
    ) -> String {
        var counts = ["成功 \(result.succeededCount) 篇"]
        if result.skippedCount > 0 {
            counts.append("跳过 \(result.skippedCount) 篇")
        }
        counts.append("失败 \(failedCount) 篇")

        let reasons = result.issues
            .compactMap(\.message)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(2)
        guard !reasons.isEmpty else {
            return counts.joined(separator: "，")
        }
        return "\(counts.joined(separator: "，"))；\(reasons.joined(separator: "；"))"
    }
}

/// 单篇与批量归档、分类共用同一选择器，保证 AI 与最近使用体验一致。
struct BulkCategorySelectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Bindable var model: LibraryModel
    @Bindable var catalog: CategoryCatalogModel
    let request: BulkCategoryRequest

    var body: some View {
        BulkCategoryPickerContainer(
            model: model,
            catalog: catalog,
            request: request,
            onDismiss: { dismiss() }
        )
    }
}

@MainActor
private struct BulkCategoryPickerContainer: View {
    let model: LibraryModel
    let catalog: CategoryCatalogModel
    let request: BulkCategoryRequest
    let onDismiss: () -> Void

    @State private var pickerModel: CategoryPickerModel

    init(
        model: LibraryModel,
        catalog: CategoryCatalogModel,
        request: BulkCategoryRequest,
        onDismiss: @escaping () -> Void
    ) {
        self.model = model
        self.catalog = catalog
        self.request = request
        self.onDismiss = onDismiss
        _pickerModel = State(initialValue: CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: Self.selectedCategoryID(for: request, model: model),
            targetCount: request.targetArticleID == nil ? model.bulkSelection.count : 1
        ))
    }

    var body: some View {
        CategoryPickerContent(
            model: pickerModel,
            title: request.targetArticleID == nil
                ? request.purpose.title
                : request.purpose.singleTargetTitle,
            subtitle: request.purpose.subtitle,
            onSelectCategory: { category in
                await 分配(category)
            },
            onSelectAI: {
                await 交给AI判断()
            },
            onDismiss: onDismiss
        )
    }

    private func 分配(_ category: ArticleCategory) async -> CategoryAssignmentOutcome {
        if let articleID = request.targetArticleID {
            switch request.purpose {
            case .archive:
                await model.runArticleToolbarAction(
                    .archive,
                    articleID: articleID,
                    categoryID: category.id
                )
            case .setCategory:
                await model.runArticleCategory(
                    articleID: articleID,
                    category: category
                )
            }
        } else {
            switch request.purpose {
            case .archive:
                await model.runBulkToolbarAction(.archive, categoryID: category.id)
            case .setCategory:
                await model.runBulkCategory(category)
            }
        }

        let outcome = BulkCategoryOutcomeMapper.outcome(
            result: model.bulkResult,
            error: model.lastBulkActionError,
            operation: .manual
        )
        if case .success = outcome {
            catalog.recordRecent(categoryID: category.id)
        }
        return outcome
    }

    private func 交给AI判断() async -> CategoryAssignmentOutcome {
        if let articleID = request.targetArticleID {
            switch request.purpose {
            case .archive:
                await model.runArticleToolbarAction(.archive, articleID: articleID)
            case .setCategory:
                await model.runArticleCategoryByAI(articleID: articleID)
            }
        } else {
            switch request.purpose {
            case .archive:
                await model.runBulkToolbarAction(.archive)
            case .setCategory:
                await model.runBulkCategoryByAI()
            }
        }

        return BulkCategoryOutcomeMapper.outcome(
            result: model.bulkResult,
            error: model.lastBulkActionError,
            operation: .ai
        )
    }

    private static func selectedCategoryID(
        for request: BulkCategoryRequest,
        model: LibraryModel
    ) -> Int? {
        guard request.purpose == .setCategory,
              let articleID = request.targetArticleID
        else {
            return nil
        }
        return model.articles.first { $0.id == articleID }?.category?.id
    }
}
