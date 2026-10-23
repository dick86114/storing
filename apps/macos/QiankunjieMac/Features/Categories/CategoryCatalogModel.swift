import Foundation
import Observation
import QiankunjieCore

@MainActor
@Observable
final class CategoryCatalogModel: Observable {
    private let service: any CategoryCatalogServicing
    private let recentStore: any CategoryRecentStoring
    private let refreshTTL: TimeInterval

    private(set) var categories: [ArticleCategory] = []
    private(set) var counts: [Int: Int] = [:]
    private(set) var recentCategoryIDs: [Int] = []
    private(set) var isLoading = false
    private(set) var hasLoadedCatalog = false
    private(set) var isMutating = false
    private(set) var errorMessage: String?
    var userID: Int?
    var onCategoriesChanged: (@MainActor () -> Void)?

    @ObservationIgnored private var requestGeneration = 0
    @ObservationIgnored private var loadSequence = 0
    @ObservationIgnored private var catalogRevision = 0
    @ObservationIgnored private var activeMutationCount = 0
    @ObservationIgnored private var refreshFlight: 目录刷新任务?
    @ObservationIgnored private var refreshFlightID = 0
    @ObservationIgnored private var lastSuccessfulRefreshAt: Date?
    @ObservationIgnored private var needsRefresh = true
    @ObservationIgnored private let now: @MainActor () -> Date

    var activeCategories: [ArticleCategory] {
        categories.filter(\.isActive)
    }

    var recentCategories: [ArticleCategory] {
        let activeCategoriesByID = Dictionary(
            uniqueKeysWithValues: activeCategories.map { ($0.id, $0) }
        )
        return recentCategoryIDs.compactMap { activeCategoriesByID[$0] }
    }

    /// 拖拽开始和落点都复用同一就绪条件，避免刷新或变更期间提交顺序。
    var canReorder: Bool {
        hasLoadedCatalog && !isLoading && !isMutating
    }

    init(
        service: any CategoryCatalogServicing,
        recentStore: any CategoryRecentStoring,
        refreshTTL: TimeInterval = 60,
        now: @escaping @MainActor () -> Date = { Date() }
    ) {
        self.service = service
        self.recentStore = recentStore
        self.refreshTTL = refreshTTL
        self.now = now
    }

    func prepareUser(userID: Int?) {
        let previousCategories = categories
        let previousCounts = counts

        requestGeneration += 1
        loadSequence += 1
        catalogRevision += 1
        activeMutationCount = 0
        refreshFlight?.task.cancel()
        refreshFlight = nil
        self.userID = userID
        categories = []
        counts = [:]
        recentCategoryIDs = normalizedRecentCategoryIDs(
            userID.map(recentStore.load(userID:)) ?? []
        )
        isLoading = false
        hasLoadedCatalog = false
        lastSuccessfulRefreshAt = nil
        needsRefresh = true
        isMutating = false
        errorMessage = nil
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    func load() async {
        await loadCatalog(force: true)
    }

    /// 优先使用已成功加载的可信缓存，仅在首次加载或目录失效时请求服务端。
    func refreshIfNeeded() async {
        await loadCatalog(force: false)
    }

    /// 缓存只有成功刷新后在 TTL 内、且没有待同步变更时才算新鲜。
    private var shouldRefreshCatalog: Bool {
        guard hasLoadedCatalog, !needsRefresh, let lastSuccessfulRefreshAt else {
            return true
        }
        return now().timeIntervalSince(lastSuccessfulRefreshAt) >= refreshTTL
    }

    private func loadCatalog(force: Bool) async {
        guard userID != nil else { return }
        if !force, !shouldRefreshCatalog { return }

        if let refreshFlight {
            await refreshFlight.task.value
            if
                refreshFlight.requestGeneration != requestGeneration
                    || refreshFlight.revision != catalogRevision
            {
                await loadCatalog(force: force)
            }
            return
        }

        let generation = requestGeneration
        let revision = catalogRevision
        loadSequence += 1
        let sequence = loadSequence
        refreshFlightID += 1
        let flightID = refreshFlightID
        isLoading = true
        errorMessage = nil

        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                if generation == requestGeneration, sequence == loadSequence {
                    isLoading = false
                }
                if refreshFlight?.id == flightID {
                    refreshFlight = nil
                }
            }

            do {
                let response = try await service.list(includeInactive: true)
                guard
                    generation == requestGeneration,
                    sequence == loadSequence,
                    revision == catalogRevision
                else {
                    return
                }
                applyLoadedCatalog(response)
            } catch is CancellationError {
                return
            } catch {
                guard
                    generation == requestGeneration,
                    sequence == loadSequence,
                    revision == catalogRevision
                else {
                    return
                }
                errorMessage = managementErrorMessage(for: error)
                lastSuccessfulRefreshAt = nil
                needsRefresh = true
            }
        }

        refreshFlight = 目录刷新任务(
            id: flightID,
            requestGeneration: generation,
            revision: revision,
            task: task
        )
        await task.value
    }

    private func refreshCatalogDirect() async throws {
        let generation = requestGeneration
        let revision = catalogRevision
        let response = try await service.list(includeInactive: true)
        guard generation == requestGeneration, revision == catalogRevision else {
            throw CategoryCatalogInternalError.请求已过期
        }
        applyLoadedCatalog(response)
    }

    private func applyLoadedCatalog(_ response: CategoriesResponse) {
        let previousCategories = categories
        let previousCounts = counts
        categories = sortedCategories(response.categories)
        counts = normalizedCounts(response.counts)
        hasLoadedCatalog = true
        lastSuccessfulRefreshAt = now()
        needsRefresh = false
        pruneRecentCategories()
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    func create(_ draft: CategoryDraft) async throws -> ArticleCategory {
        guard hasLoadedCatalog else {
            errorMessage = "分类目录尚未加载完成，请稍后重试"
            throw CategoryCatalogInternalError.目录未加载
        }
        guard !isMutating else {
            errorMessage = "分类目录正在处理其他操作，请稍后再试"
            throw CategoryCatalogInternalError.操作进行中
        }

        let name = trimmed(draft.name)
        guard !name.isEmpty else {
            errorMessage = "请输入分类名称"
            throw CategoryCatalogInternalError.名称为空
        }
        guard name.count <= 40 else {
            errorMessage = "分类名称不能超过 40 个字符"
            throw CategoryCatalogInternalError.名称过长
        }
        guard !activeCategories.contains(where: {
            $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame
        }) else {
            errorMessage = "已存在同名启用分类，请换一个名称"
            throw AppError.categoryConflict(message: "已存在同名启用分类，请换一个名称")
        }

        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.create(mutationRequest(from: draft))
            try ensureCurrentGeneration(generation)
            applyCreatedCategory(response.category)
            return response.category
        } catch {
            if case AppError.categoryConflict = error, generation == requestGeneration {
                try? await refreshCatalogDirect()
            }
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func update(_ category: ArticleCategory, draft: CategoryDraft) async throws -> ArticleCategory {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.update(
                categoryID: category.id,
                request: mutationRequest(from: draft)
            )
            try ensureCurrentGeneration(generation)
            applyUpdatedCategory(response.category)
            return response.category
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func setActive(categoryID: Int, isActive: Bool) async throws -> ArticleCategory {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let request = CategoryMutationRequest(
                name: nil,
                description: nil,
                includeExamples: nil,
                excludeExamples: nil,
                color: nil,
                isActive: isActive
            )
            let response = try await service.update(categoryID: categoryID, request: request)
            try ensureCurrentGeneration(generation)
            applyUpdatedCategory(response.category)
            return response.category
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func reorder(categoryIDs: [Int]) async throws {
        try validateReorder(categoryIDs)
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.reorder(categoryIDs: categoryIDs)
            try ensureCurrentGeneration(generation)
            let previousCategories = categories
            let previousCounts = counts
            categories = sortedCategories(response.categories)
            pruneRecentCategories()
            publishCatalogChangesIfNeeded(
                previousCategories: previousCategories,
                previousCounts: previousCounts
            )
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func reorder(moving categoryID: Int, to targetCategoryID: Int) async throws {
        let protectedIDs = Set(categories.filter(\.isSystem).map(\.id))
        guard
            let categoryIDs = CategoryOrdering.reorderedIDs(
                categories.map(\.id),
                moving: categoryID,
                to: targetCategoryID,
                protecting: protectedIDs
            )
        else {
            return
        }
        try await reorder(categoryIDs: categoryIDs)
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> Int {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.delete(
                categoryID: categoryID,
                targetCategoryID: targetCategoryID
            )
            try ensureCurrentGeneration(generation)

            let previousCategories = categories
            let previousCounts = counts
            categories.removeAll { $0.id == categoryID }
            counts.removeValue(forKey: categoryID)
            counts[targetCategoryID] = count(for: targetCategoryID) + response.movedArticleCount
            pruneRecentCategories()
            publishCatalogChangesIfNeeded(
                previousCategories: previousCategories,
                previousCounts: previousCounts
            )
            return response.movedArticleCount
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            try await service.merge(
                sourceCategoryID: sourceCategoryID,
                targetCategoryID: targetCategoryID
            )
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }

        try ensureCurrentGeneration(generation)
        applyMergedCategoryLocally(
            sourceCategoryID: sourceCategoryID,
            targetCategoryID: targetCategoryID
        )

        do {
            try await refreshCatalogDirect()
        } catch CategoryCatalogInternalError.请求已过期 {
            throw CategoryCatalogInternalError.请求已过期
        } catch {
            handleMutationError(error, generation: generation)
            throw CategoryCatalogMutationError.mergeCommittedButRefreshFailed
        }
    }

    func optimize(_ draft: CategoryDraft) async throws -> CategoryDraft {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.optimize(
                CategoryOptimizeRequest(
                    name: trimmed(draft.name),
                    description: nonEmpty(trimmed(draft.description)),
                    includeExamples: normalizedExamples(draft.includeExamples),
                    excludeExamples: normalizedExamples(draft.excludeExamples)
                )
            )
            try ensureCurrentGeneration(generation)

            var optimized = draft
            if let description = response.draft.description, !description.isEmpty {
                optimized.description = description
            }
            if let examples = response.draft.includeExamples, !examples.isEmpty {
                optimized.includeExamples = examples
            }
            if let examples = response.draft.excludeExamples, !examples.isEmpty {
                optimized.excludeExamples = examples
            }
            return optimized
        } catch {
            handleMutationError(error, generation: generation)
            throw error
        }
    }

    func recordRecent(categoryID: Int) {
        guard let userID, categories.contains(where: { $0.id == categoryID && $0.isActive }) else {
            return
        }

        var nextIDs = recentCategoryIDs.filter { $0 != categoryID }
        nextIDs.insert(categoryID, at: 0)
        nextIDs = normalizedRecentCategoryIDs(nextIDs)
        guard nextIDs != recentCategoryIDs else { return }

        recentCategoryIDs = nextIDs
        recentStore.save(nextIDs, userID: userID)
    }

    func count(for categoryID: Int) -> Int {
        counts[categoryID] ?? 0
    }

    func presentError(_ message: String) {
        errorMessage = message
    }

    func clearError() {
        errorMessage = nil
    }

    private func beginMutation() throws -> Int {
        guard userID != nil else { throw CategoryCatalogInternalError.未登录 }
        catalogRevision += 1
        needsRefresh = true
        activeMutationCount += 1
        isMutating = true
        errorMessage = nil
        return requestGeneration
    }

    private func validateReorder(_ categoryIDs: [Int]) throws {
        guard hasLoadedCatalog else {
            errorMessage = "分类目录尚未加载完成，请稍后重试"
            throw CategoryCatalogInternalError.目录未加载
        }
        guard !isLoading else {
            errorMessage = "分类目录正在更新，请稍后重试"
            throw CategoryCatalogInternalError.目录正在更新
        }
        guard !isMutating else {
            errorMessage = "分类目录正在处理其他操作，请稍后再试"
            throw CategoryCatalogInternalError.操作进行中
        }

        let currentIDs = categories.map(\.id)
        guard
            categoryIDs.count == currentIDs.count,
            Set(categoryIDs).count == categoryIDs.count,
            Set(categoryIDs) == Set(currentIDs)
        else {
            errorMessage = "分类排序数据无效"
            throw CategoryCatalogInternalError.排序数据无效
        }

        let protectedIDs = Set(categories.filter(\.isSystem).map(\.id))
        for (originalIndex, categoryID) in currentIDs.enumerated() {
            guard let proposedIndex = categoryIDs.firstIndex(of: categoryID) else {
                errorMessage = "分类排序数据无效"
                throw CategoryCatalogInternalError.排序数据无效
            }
            let originalProtectedDepth = currentIDs[..<originalIndex]
                .filter(protectedIDs.contains)
                .count
            let proposedProtectedDepth = categoryIDs[..<proposedIndex]
                .filter(protectedIDs.contains)
                .count
            guard originalProtectedDepth == proposedProtectedDepth else {
                errorMessage = "系统分类必须保持固定位置"
                throw CategoryCatalogInternalError.系统分类位置固定
            }
        }
    }

    private func endMutation(_ generation: Int) {
        guard generation == requestGeneration else { return }
        activeMutationCount = max(0, activeMutationCount - 1)
        isMutating = activeMutationCount > 0
    }

    private func ensureCurrentGeneration(_ generation: Int) throws {
        guard generation == requestGeneration else {
            throw CategoryCatalogInternalError.请求已过期
        }
    }

    private func handleMutationError(_ error: any Error, generation: Int) {
        guard generation == requestGeneration else { return }
        errorMessage = managementErrorMessage(for: error)
    }

    private func applyCreatedCategory(_ category: ArticleCategory) {
        let previousCategories = categories
        let previousCounts = counts

        categories = sortedCategories(categories.filter { $0.id != category.id } + [category])
        if counts[category.id] == nil {
            counts[category.id] = 0
        }
        pruneRecentCategories()
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    private func applyUpdatedCategory(_ category: ArticleCategory) {
        let previousCategories = categories
        let previousCounts = counts

        categories = sortedCategories(categories.filter { $0.id != category.id } + [category])
        if counts[category.id] == nil {
            counts[category.id] = 0
        }
        pruneRecentCategories()
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    /// 合并接口成功后立即在本地镜像软停用与文章迁移，刷新失败时仍能展示已提交结果。
    private func applyMergedCategoryLocally(
        sourceCategoryID: Int,
        targetCategoryID: Int
    ) {
        guard let sourceIndex = categories.firstIndex(where: { $0.id == sourceCategoryID }) else {
            return
        }

        let previousCategories = categories
        let previousCounts = counts
        let source = categories[sourceIndex]
        let movedArticleCount = counts[sourceCategoryID] ?? 0

        categories[sourceIndex] = ArticleCategory(
            id: source.id,
            name: source.name,
            articleDescription: source.articleDescription,
            includeExamples: source.includeExamples,
            excludeExamples: source.excludeExamples,
            color: source.color,
            sortOrder: source.sortOrder,
            isActive: false,
            isSystem: source.isSystem
        )
        categories = sortedCategories(categories)
        counts[sourceCategoryID] = 0
        counts[targetCategoryID] = count(for: targetCategoryID) + movedArticleCount
        pruneRecentCategories()
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    private func publishCatalogChangesIfNeeded(
        previousCategories: [ArticleCategory],
        previousCounts: [Int: Int]
    ) {
        guard previousCategories != categories || previousCounts != counts else { return }
        onCategoriesChanged?()
    }

    private func sortedCategories(_ categories: [ArticleCategory]) -> [ArticleCategory] {
        categories.sorted {
            if $0.sortOrder == $1.sortOrder { return $0.id < $1.id }
            return $0.sortOrder < $1.sortOrder
        }
    }

    private func normalizedCounts(_ counts: [String: Int]) -> [Int: Int] {
        counts.reduce(into: [:]) { result, entry in
            guard let categoryID = Int(entry.key), categoryID > 0 else { return }
            result[categoryID] = entry.value
        }
    }

    private func mutationRequest(from draft: CategoryDraft) -> CategoryMutationRequest {
        let includeExamples = normalizedExamples(draft.includeExamples)
        let excludeExamples = normalizedExamples(draft.excludeExamples)
        return CategoryMutationRequest(
            name: trimmed(draft.name),
            description: nonEmpty(trimmed(draft.description)),
            includeExamples: includeExamples.isEmpty ? nil : includeExamples,
            excludeExamples: excludeExamples.isEmpty ? nil : excludeExamples,
            color: nonEmpty(trimmed(draft.color)),
            isActive: nil
        )
    }

    private func normalizedExamples(_ examples: [String]) -> [String] {
        var seen = Set<String>()
        return examples.compactMap { example in
            let value = trimmed(example)
            guard !value.isEmpty, seen.insert(value).inserted else { return nil }
            return value
        }
    }

    private func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func nonEmpty(_ value: String) -> String? {
        value.isEmpty ? nil : value
    }

    private func pruneRecentCategories() {
        let activeIDs = Set(activeCategories.map(\.id))
        let pruned = normalizedRecentCategoryIDs(recentCategoryIDs, allowedIDs: activeIDs)
        guard pruned != recentCategoryIDs else { return }

        recentCategoryIDs = pruned
        if let userID {
            recentStore.save(pruned, userID: userID)
        }
    }

    private func normalizedRecentCategoryIDs(
        _ categoryIDs: [Int],
        allowedIDs: Set<Int>? = nil
    ) -> [Int] {
        var seen = Set<Int>()
        var result: [Int] = []
        for categoryID in categoryIDs where categoryID > 0 {
            if let allowedIDs, !allowedIDs.contains(categoryID) { continue }
            guard seen.insert(categoryID).inserted else { continue }
            result.append(categoryID)
            if result.count == 5 { break }
        }
        return result
    }
}

private enum CategoryCatalogInternalError: Error {
    case 未登录
    case 请求已过期
    case 目录未加载
    case 目录正在更新
    case 操作进行中
    case 排序数据无效
    case 系统分类位置固定
    case 名称为空
    case 名称过长
}

private struct 目录刷新任务 {
    let id: Int
    let requestGeneration: Int
    let revision: Int
    let task: Task<Void, Never>
}
