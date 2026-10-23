import Observation
import QiankunjieCore

@MainActor
@Observable
final class CategoryCatalogModel: Observable {
    private let service: any CategoryCatalogServicing
    private let recentStore: any CategoryRecentStoring

    private(set) var categories: [ArticleCategory] = []
    private(set) var counts: [Int: Int] = [:]
    private(set) var recentCategoryIDs: [Int] = []
    private(set) var isLoading = false
    private(set) var isMutating = false
    private(set) var errorMessage: String?
    var userID: Int?
    var onCategoriesChanged: (@MainActor () -> Void)?

    @ObservationIgnored private var requestGeneration = 0
    @ObservationIgnored private var loadSequence = 0
    @ObservationIgnored private var activeMutationCount = 0

    var activeCategories: [ArticleCategory] {
        categories.filter(\.isActive)
    }

    var recentCategories: [ArticleCategory] {
        let activeCategoriesByID = Dictionary(
            uniqueKeysWithValues: activeCategories.map { ($0.id, $0) }
        )
        return recentCategoryIDs.compactMap { activeCategoriesByID[$0] }
    }

    init(service: any CategoryCatalogServicing, recentStore: any CategoryRecentStoring) {
        self.service = service
        self.recentStore = recentStore
    }

    func prepareUser(userID: Int?) {
        let previousCategories = categories
        let previousCounts = counts

        requestGeneration += 1
        loadSequence += 1
        activeMutationCount = 0
        self.userID = userID
        categories = []
        counts = [:]
        recentCategoryIDs = normalizedRecentCategoryIDs(
            userID.map(recentStore.load(userID:)) ?? []
        )
        isLoading = false
        isMutating = false
        errorMessage = nil
        publishCatalogChangesIfNeeded(
            previousCategories: previousCategories,
            previousCounts: previousCounts
        )
    }

    func load() async {
        guard userID != nil else { return }

        let generation = requestGeneration
        loadSequence += 1
        let sequence = loadSequence
        isLoading = true
        errorMessage = nil

        defer {
            if generation == requestGeneration && sequence == loadSequence {
                isLoading = false
            }
        }

        do {
            let response = try await service.list(includeInactive: true)
            guard generation == requestGeneration, sequence == loadSequence else { return }

            let previousCategories = categories
            let previousCounts = counts
            categories = sortedCategories(response.categories)
            counts = normalizedCounts(response.counts)
            pruneRecentCategories()
            publishCatalogChangesIfNeeded(
                previousCategories: previousCategories,
                previousCounts: previousCounts
            )
        } catch {
            guard generation == requestGeneration, sequence == loadSequence else { return }
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func create(_ draft: CategoryDraft) async throws -> ArticleCategory {
        let generation = try beginMutation()
        defer { endMutation(generation) }

        do {
            let response = try await service.create(mutationRequest(from: draft))
            try ensureCurrentGeneration(generation)
            applyCreatedCategory(response.category)
            return response.category
        } catch {
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
            try ensureCurrentGeneration(generation)
            await load()
        } catch {
            handleMutationError(error, generation: generation)
            throw error
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

    private func beginMutation() throws -> Int {
        guard userID != nil else { throw CategoryCatalogInternalError.未登录 }
        activeMutationCount += 1
        isMutating = true
        errorMessage = nil
        return requestGeneration
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
}
