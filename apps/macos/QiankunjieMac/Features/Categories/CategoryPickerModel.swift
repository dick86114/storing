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
    private let openedUserID: Int?

    var currentUserID: Int? {
        catalog.userID
    }

    var isStaleForCurrentUser: Bool {
        catalog.userID != openedUserID
    }

    var recentCategories: [ArticleCategory] {
        guard !isStaleForCurrentUser, normalizedQuery.isEmpty else { return [] }
        return catalog.recentCategories
    }

    var filteredCategories: [ArticleCategory] {
        guard !isStaleForCurrentUser else { return [] }
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
        guard !isStaleForCurrentUser, !normalizedQuery.isEmpty else { return nil }
        return catalog.activeCategories.first {
            $0.name.localizedCaseInsensitiveCompare(normalizedQuery) == .orderedSame
        }
    }

    var canCreate: Bool {
        !isStaleForCurrentUser
            && catalog.hasLoadedCatalog
            && !catalog.isLoading
            && !catalog.isMutating
            && !normalizedQuery.isEmpty
            && exactMatch == nil
            && !isSubmitting
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
        !isStaleForCurrentUser && !catalog.activeCategories.isEmpty
    }

    init(catalog: CategoryCatalogModel, selectedCategoryID: Int?, targetCount: Int) {
        self.catalog = catalog
        self.openedUserID = catalog.userID
        self.selectedCategoryID = selectedCategoryID
        self.targetCount = targetCount
    }

    func selectExisting(
        _ category: ArticleCategory,
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool {
        guard 确保用户上下文有效() else { return false }
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        guard catalog.activeCategories.contains(where: { $0.id == category.id }) else {
            await 处理失效分类()
            return false
        }

        let outcome = await assign(category)
        guard 确保用户上下文有效() else { return false }
        return await 处理已有分类结果(outcome, category: category)
    }

    func createAndAssign(
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool {
        guard 确保用户上下文有效() else { return false }
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        if let existing = exactMatch {
            let outcome = await assign(existing)
            guard 确保用户上下文有效() else { return false }
            return await 处理已有分类结果(outcome, category: existing)
        }

        guard 确保目录允许创建() else { return false }

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
        guard 确保用户上下文有效() else { return false }
        switch outcome {
        case .success:
            catalog.recordRecent(categoryID: category.id)
            return true
        case let .partial(_, _, _, message):
            errorMessage = message.isEmpty
                ? "分类已创建，但部分文章未完成分类"
                : "分类已创建，但部分文章未完成分类：\(message)"
            return false
        case .categoryUnavailable:
            errorMessage = "分类已创建，但分类已失效"
            await catalog.load()
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
        guard 确保用户上下文有效() else { return false }
        guard !isSubmitting else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let outcome = await assign()
        guard 确保用户上下文有效() else { return false }
        switch outcome {
        case .success:
            return true
        case let .partial(_, _, _, message):
            errorMessage = message.isEmpty
                ? "AI 分类未全部完成"
                : "AI 分类未全部完成：\(message)"
            return false
        case .categoryUnavailable:
            await 处理失效分类()
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
        case .categoryUnavailable:
            await 处理失效分类()
            return false
        case let .failure(message):
            errorMessage = message.isEmpty ? "分类失败，请稍后重试" : message
            return false
        }
    }

    private func 处理失效分类() async {
        errorMessage = "分类已失效"
        await catalog.load()
    }

    private func 确保用户上下文有效() -> Bool {
        guard !isStaleForCurrentUser else {
            errorMessage = "登录用户已切换，请重新打开分类选择器"
            return false
        }
        return true
    }

    private func 确保目录允许创建() -> Bool {
        guard 确保用户上下文有效() else { return false }
        guard catalog.hasLoadedCatalog else {
            errorMessage = "分类目录尚未加载完成，请稍后重试"
            return false
        }
        guard !catalog.isLoading else {
            errorMessage = "分类目录正在更新，请稍后再试"
            return false
        }
        guard !catalog.isMutating else {
            errorMessage = "分类目录正在处理其他操作，请稍后再试"
            return false
        }
        return true
    }
}
