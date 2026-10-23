import Observation
import QiankunjieCore

@MainActor
@Observable
final class CategoryPickerModel: Observable {
    let selectedCategoryID: Int?
    let targetCount: Int
    var query = "" {
        didSet {
            if query != oldValue {
                errorMessage = nil
            }
        }
    }
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?

    private let catalog: CategoryCatalogModel

    var recentCategories: [ArticleCategory] {
        guard normalizedQuery.isEmpty else { return [] }
        return catalog.recentCategories
    }

    var filteredCategories: [ArticleCategory] {
        let activeCategories = catalog.activeCategories
        guard !normalizedQuery.isEmpty else {
            let recentIDs = Set(catalog.recentCategoryIDs)
            return activeCategories.filter { !recentIDs.contains($0.id) }
        }
        return activeCategories.filter {
            $0.name.localizedCaseInsensitiveContains(normalizedQuery)
        }
    }

    var exactMatch: ArticleCategory? {
        guard !normalizedQuery.isEmpty else { return nil }
        return catalog.activeCategories.first {
            $0.name.localizedCaseInsensitiveCompare(normalizedQuery) == .orderedSame
        }
    }

    var canCreate: Bool {
        !normalizedQuery.isEmpty && exactMatch == nil && !isSubmitting
    }

    var isLoadingCatalog: Bool {
        catalog.isLoading
    }

    var catalogErrorMessage: String? {
        catalog.errorMessage
    }

    var isCatalogMutating: Bool {
        catalog.isMutating
    }

    var hasActiveCategories: Bool {
        !catalog.activeCategories.isEmpty
    }

    init(catalog: CategoryCatalogModel, selectedCategoryID: Int?, targetCount: Int) {
        self.catalog = catalog
        self.selectedCategoryID = selectedCategoryID
        self.targetCount = targetCount
    }

    func selectExisting(
        _ category: ArticleCategory,
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool {
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        guard catalog.activeCategories.contains(where: { $0.id == category.id }) else {
            await 处理失效分类()
            return false
        }

        let outcome = await assign(category)
        return await 处理已有分类结果(outcome, category: category)
    }

    func createAndAssign(
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool {
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        if let existing = exactMatch {
            let outcome = await assign(existing)
            return await 处理已有分类结果(outcome, category: existing)
        }

        let name = normalizedQuery
        guard !name.isEmpty else {
            errorMessage = "请输入分类名称"
            return false
        }

        let category: ArticleCategory
        do {
            var draft = CategoryDraft()
            draft.name = name
            category = try await catalog.create(draft)
        } catch {
            errorMessage = managementErrorMessage(for: error)
            return false
        }

        let outcome = await assign(category)
        switch outcome {
        case .success:
            catalog.recordRecent(categoryID: category.id)
            return true
        case let .partial(_, _, _, message):
            errorMessage = message.isEmpty
                ? "分类已创建，但部分文章未完成分类"
                : "分类已创建，但部分文章未完成分类：\(message)"
            return false
        case let .failure(message):
            errorMessage = message.isEmpty
                ? "分类已创建，但文章未完成分类"
                : "分类已创建，但文章未完成分类：\(message)"
            return false
        }
    }

    func assignWithAI(
        assign: @MainActor () async -> CategoryAssignmentOutcome
    ) async -> Bool {
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let outcome = await assign()
        switch outcome {
        case .success:
            return true
        case let .partial(_, _, _, message):
            errorMessage = message.isEmpty
                ? "AI 分类未全部完成"
                : "AI 分类未全部完成：\(message)"
            return false
        case let .failure(message):
            errorMessage = message.isEmpty ? "AI 分类失败，请稍后重试" : message
            return false
        }
    }

    func reloadCatalog() async {
        errorMessage = nil
        await catalog.load()
    }

    func clearError() {
        errorMessage = nil
    }

    private var normalizedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func 处理已有分类结果(
        _ outcome: CategoryAssignmentOutcome,
        category: ArticleCategory
    ) async -> Bool {
        switch outcome {
        case .success:
            catalog.recordRecent(categoryID: category.id)
            return true
        case let .partial(_, _, _, message):
            errorMessage = message.isEmpty
                ? "部分文章未完成分类"
                : "部分文章未完成分类：\(message)"
            return false
        case let .failure(message):
            if 是分类失效错误(message) {
                await 处理失效分类()
            } else {
                errorMessage = message.isEmpty ? "分类失败，请稍后重试" : message
            }
            return false
        }
    }

    private func 处理失效分类() async {
        errorMessage = "分类已失效"
        await catalog.load()
    }

    private func 是分类失效错误(_ message: String) -> Bool {
        // 分配结果只携带用户文案，因此使用共享的 contentUnavailable 文案识别失效分类。
        let contentUnavailableMessage = managementErrorMessage(for: AppError.contentUnavailable)
        return message == contentUnavailableMessage
            || message.localizedCaseInsensitiveContains("分类不存在")
            || message.localizedCaseInsensitiveContains("分类已失效")
    }
}
