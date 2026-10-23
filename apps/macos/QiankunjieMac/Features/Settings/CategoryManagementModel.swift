import Observation
import QiankunjieCore

@MainActor
@Observable
final class CategoryManagementModel: Observable {
    let catalog: CategoryCatalogModel

    var selectedCategoryID: Int?
    var searchText = ""
    var isCreating = false
    var editingCategory: ArticleCategory?
    var deletingCategory: ArticleCategory?

    private(set) var errorMessage: String?
    private(set) var noticeMessage: String?
    private(set) var isSaving = false
    private(set) var isOptimizing = false
    private(set) var shouldOfferRefreshAfterMerge = false

    @ObservationIgnored private var stateGeneration = 0

    init(catalog: CategoryCatalogModel) {
        self.catalog = catalog
    }

    var filteredCategories: [ArticleCategory] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return catalog.categories }
        return catalog.categories.filter {
            $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    var selectedCategory: ArticleCategory? {
        guard let selectedCategoryID else { return nil }
        return catalog.categories.first { $0.id == selectedCategoryID }
    }

    var isBusy: Bool {
        isSaving || isOptimizing || catalog.isMutating
    }

    func load() async {
        await loadCatalog(force: false)
    }

    func refresh() async {
        await loadCatalog(force: true)
    }

    private func loadCatalog(force: Bool) async {
        guard !isBusy else { return }

        let generation = beginStateCycle()
        errorMessage = nil
        noticeMessage = nil
        shouldOfferRefreshAfterMerge = false

        if force {
            await catalog.load()
        } else {
            await catalog.refreshIfNeeded()
        }

        guard isCurrent(generation) else { return }
        errorMessage = catalog.errorMessage
    }

    func select(categoryID: Int?) {
        selectedCategoryID = categoryID
    }

    func save(_ draft: CategoryDraft, editing category: ArticleCategory?) async {
        if let category, category.isSystem {
            errorMessage = "系统分类不可编辑"
            return
        }
        guard ensureIdle() else { return }

        let generation = beginSaving()
        defer { finishSaving(generation) }

        do {
            if let category {
                let updated = try await catalog.update(category, draft: draft)
                guard isCurrent(generation) else { return }
                selectedCategoryID = updated.id
                editingCategory = nil
                noticeMessage = "分类已更新"
            } else {
                let created = try await catalog.create(draft)
                guard isCurrent(generation) else { return }
                selectedCategoryID = created.id
                isCreating = false
                noticeMessage = "分类已创建"
            }
        } catch {
            guard isCurrent(generation) else { return }
            present(error)
        }
    }

    func setActive(_ category: ArticleCategory, isActive: Bool) async {
        guard !category.isSystem else {
            errorMessage = "系统分类不可停用"
            return
        }
        guard ensureIdle() else { return }

        let generation = beginSaving()
        defer { finishSaving(generation) }

        do {
            _ = try await catalog.setActive(categoryID: category.id, isActive: isActive)
            guard isCurrent(generation) else { return }
            noticeMessage = isActive ? "分类已重新启用" : "分类已停用"
        } catch {
            guard isCurrent(generation) else { return }
            present(error)
        }
    }

    func reorder(moving categoryID: Int, offset: Int) async {
        guard offset != 0 else { return }
        guard ensureIdle() else { return }
        guard let sourceCategory = catalog.categories.first(where: { $0.id == categoryID }) else {
            return
        }
        guard !sourceCategory.isSystem else {
            errorMessage = "系统分类不可排序"
            return
        }

        let sourceIndex = catalog.categories.firstIndex { $0.id == categoryID }
        guard let sourceIndex else { return }
        let targetIndex = sourceIndex + offset
        guard catalog.categories.indices.contains(targetIndex) else { return }
        guard !catalog.categories[targetIndex].isSystem else {
            errorMessage = "系统分类不可参与排序"
            return
        }

        var categoryIDs = catalog.categories.map(\.id)
        categoryIDs.remove(at: sourceIndex)
        categoryIDs.insert(categoryID, at: targetIndex)

        let generation = beginSaving()
        defer { finishSaving(generation) }

        do {
            try await catalog.reorder(categoryIDs: categoryIDs)
            guard isCurrent(generation) else { return }
            noticeMessage = "分类顺序已更新"
        } catch {
            guard isCurrent(generation) else { return }
            present(error)
        }
    }

    func delete(_ category: ArticleCategory, targetCategoryID: Int) async {
        guard !category.isSystem else {
            errorMessage = "系统分类不可删除"
            return
        }
        guard ensureIdle() else { return }
        guard category.id != targetCategoryID else {
            errorMessage = "不能将文章迁移到即将删除的分类"
            return
        }
        guard catalog.categories.contains(where: {
            $0.id == targetCategoryID && $0.isActive
        }) else {
            errorMessage = "请选择启用中的目标分类"
            return
        }

        let generation = beginSaving()
        defer { finishSaving(generation) }

        do {
            let movedArticleCount = try await catalog.delete(
                categoryID: category.id,
                targetCategoryID: targetCategoryID
            )
            guard isCurrent(generation) else { return }
            if selectedCategoryID == category.id {
                selectedCategoryID = nil
            }
            deletingCategory = nil
            noticeMessage = "分类已删除，已迁移 \(movedArticleCount) 篇文章"
        } catch {
            guard isCurrent(generation) else { return }
            present(error)
        }
    }

    func merge(_ source: ArticleCategory, into target: ArticleCategory) async {
        guard !source.isSystem else {
            errorMessage = "系统分类不可合并"
            return
        }
        guard ensureIdle() else { return }
        guard source.id != target.id else {
            errorMessage = "不能将分类合并到自身"
            return
        }
        guard target.isActive else {
            errorMessage = "请选择启用中的目标分类"
            return
        }

        let generation = beginSaving()
        defer { finishSaving(generation) }

        do {
            try await catalog.merge(
                sourceCategoryID: source.id,
                targetCategoryID: target.id
            )
            guard isCurrent(generation) else { return }
            if selectedCategoryID == source.id {
                selectedCategoryID = nil
            }
            noticeMessage = "分类已合并到“\(target.name)”"
        } catch CategoryCatalogMutationError.mergeCommittedButRefreshFailed {
            guard isCurrent(generation) else { return }
            catalog.clearError()
            if selectedCategoryID == source.id {
                selectedCategoryID = nil
            }
            shouldOfferRefreshAfterMerge = true
            errorMessage = nil
            noticeMessage = "合并已提交，但分类目录刷新失败，请重试刷新"
        } catch {
            guard isCurrent(generation) else { return }
            present(error)
        }
    }

    func optimize(_ draft: CategoryDraft) async -> CategoryDraft? {
        guard ensureIdle() else { return nil }

        let generation = beginOptimizing()
        defer { finishOptimizing(generation) }

        do {
            let optimized = try await catalog.optimize(draft)
            guard isCurrent(generation) else { return nil }
            noticeMessage = "已生成分类规则草案"
            return optimized
        } catch {
            guard isCurrent(generation) else { return nil }
            present(error)
            return nil
        }
    }

    func didCreate(_ category: ArticleCategory) {
        isCreating = false
        errorMessage = nil
        selectedCategoryID = category.id
        noticeMessage = "已选中分类「\(category.name)」"
    }

    func cancelCreation() {
        isCreating = false
        errorMessage = catalog.errorMessage?.hasPrefix("已取消创建") == true
            ? catalog.errorMessage
            : nil
        catalog.clearError()
    }

    func clearError() {
        errorMessage = nil
        catalog.clearError()
    }

    func clearNotice() {
        noticeMessage = nil
        shouldOfferRefreshAfterMerge = false
    }

    func resetForUserChange() {
        stateGeneration += 1
        selectedCategoryID = nil
        searchText = ""
        isCreating = false
        editingCategory = nil
        deletingCategory = nil
        errorMessage = nil
        noticeMessage = nil
        isSaving = false
        isOptimizing = false
        shouldOfferRefreshAfterMerge = false
    }

    private func beginStateCycle() -> Int {
        stateGeneration += 1
        return stateGeneration
    }

    private func beginSaving() -> Int {
        let generation = beginStateCycle()
        isSaving = true
        errorMessage = nil
        noticeMessage = nil
        shouldOfferRefreshAfterMerge = false
        return generation
    }

    private func finishSaving(_ generation: Int) {
        guard isCurrent(generation) else { return }
        isSaving = false
    }

    private func beginOptimizing() -> Int {
        let generation = beginStateCycle()
        isOptimizing = true
        errorMessage = nil
        noticeMessage = nil
        shouldOfferRefreshAfterMerge = false
        return generation
    }

    private func finishOptimizing(_ generation: Int) {
        guard isCurrent(generation) else { return }
        isOptimizing = false
    }

    private func isCurrent(_ generation: Int) -> Bool {
        generation == stateGeneration
    }

    private func ensureIdle() -> Bool {
        guard !isBusy else {
            errorMessage = "分类操作正在进行，请稍后再试"
            return false
        }
        return true
    }

    private func present(_ error: any Error) {
        shouldOfferRefreshAfterMerge = false
        errorMessage = catalog.errorMessage ?? managementErrorMessage(for: error)
    }
}
