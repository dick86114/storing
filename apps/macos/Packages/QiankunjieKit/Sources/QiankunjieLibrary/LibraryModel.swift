import Foundation
import Observation
import QiankunjieCore

public enum LibraryDisplayState: Equatable, Sendable {
    case loading
    case content
    case empty
    case error
}

private struct BulkOperationContext {
    let userID: Int?
    let generation: Int
    let operationID: Int
}

@MainActor
@Observable
public final class LibraryModel {
    public var selectedArticleID: Int?
    public var searchDraft: String = ""
    public private(set) var userID: Int?
    public private(set) var view: LibraryView = .inbox
    public private(set) var appliedSearchText = ""

    public var isSearching: Bool {
        !appliedSearchText.isEmpty
    }
    public private(set) var sort: ArticleSort = .collected
    public private(set) var order: QiankunjieCore.SortOrder = .desc
    public private(set) var source: String?
    public private(set) var categoryId: Int?
    public private(set) var articles: [ArticleCard] = []
    public private(set) var page = 1
    public private(set) var total = 0
    public private(set) var totalPages = 0
    public private(set) var perPage = 20
    public private(set) var counts: ArticleCounts?
    public private(set) var availableSources: [LibrarySource] = []
    public private(set) var isLoading = true
    public private(set) var isRefreshing = false
    public private(set) var isLoadingMore = false
    public private(set) var isShowingCache = false
    public private(set) var errorMessage: String?
    public private(set) var loadMoreErrorMessage: String?
    public private(set) var refreshErrorMessage: String?
    public private(set) var sourceErrorMessage: String?
    public private(set) var isBulkSelecting = false
    public private(set) var bulkSelection: Set<Int> = []
    public private(set) var bulkRunningAction: BulkToolbarAction?
    public private(set) var bulkResult: NativeBulkResult?
    public private(set) var lastBulkActionError: AppError?
    public private(set) var bulkExportURL: URL?
    @ObservationIgnored public var onCatalogAffectingChange: (@MainActor () -> Void)?

    private let repository: any LibraryLoading
    private let bulkRepository: any LibraryBulkOperating
    private let cache: any LibraryCaching
    private var requestGeneration = 0
    @ObservationIgnored private var bulkOperationID = 0
    private var aiPollTask: Task<Void, Never>?
    public var bulkExportHandler: (@MainActor (ArticleBulkExportJob) async throws -> URL)?
    public var bulkObsidianHandler: (@MainActor ([Int], URL) async throws -> NativeBulkResult)?

    public init(
        repository: any LibraryLoading = LibraryRepository(),
        bulkRepository: (any LibraryBulkOperating)? = nil,
        cache: (any LibraryCaching)? = nil,
        userID: Int? = nil,
        view: LibraryView = .inbox
    ) {
        self.repository = repository
        if let bulkRepository {
            self.bulkRepository = bulkRepository
        } else if let repository = repository as? any LibraryBulkOperating {
            // 列表仓库已携带登录态时，批量操作默认复用它，避免落到未认证客户端。
            self.bulkRepository = repository
        } else {
            self.bulkRepository = LibraryRepository()
        }
        self.cache = cache ?? EmptyLibraryCache()
        self.userID = userID
        self.view = view
        self.sort = ArticleSort.defaultSort(for: view)
    }

    public var displayState: LibraryDisplayState {
        if errorMessage != nil {
            return .error
        }
        if isLoading {
            return .loading
        }
        return articles.isEmpty ? .empty : .content
    }

    public var canLoadMore: Bool {
        page < totalPages && !isLoadingMore && errorMessage == nil
    }

    public var availableSorts: [ArticleSort] {
        switch view {
        case .inbox:
            [.collected, .published]
        case .favorites:
            [.favorited, .collected, .published]
        case .archive:
            [.archived, .collected, .published]
        case .published:
            [.published, .collected]
        }
    }

    public var isSourceFilterAvailable: Bool {
        view == .archive && appliedSearchText.isEmpty
    }

    public func count(for view: LibraryView) -> Int? {
        guard let counts else {
            return nil
        }
        return switch view {
        case .inbox: counts.inbox
        case .favorites: counts.favorites
        case .archive: counts.archive
        case .published: counts.published
        }
    }

    public func select(view: LibraryView) {
        clearSearchState()
        self.view = view
        sort = ArticleSort.defaultSort(for: view)
        order = .desc
        source = nil
        categoryId = nil
        availableSources = []
        sourceErrorMessage = nil
        exitBulkMode()
        resetLoadedState()
    }

    public func selectSort(_ sort: ArticleSort) {
        guard availableSorts.contains(sort), sort != self.sort else {
            return
        }

        self.sort = sort
        order = .desc
        exitBulkMode()
        resetLoadedState()
    }

    public func toggleOrder() {
        order = order == .desc ? .asc : .desc
        exitBulkMode()
        resetLoadedState()
    }

    public func selectSource(_ source: String?) {
        guard isSourceFilterAvailable else {
            return
        }

        let normalized = source?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.source = normalized == nil || normalized?.isEmpty == true ? nil : normalized
        exitBulkMode()
        resetLoadedState()
    }

    public func selectCategory(_ categoryId: Int?) {
        guard isSourceFilterAvailable else {
            return
        }

        self.categoryId = categoryId
        exitBulkMode()
        resetLoadedState()
    }

    public func submitSearch() {
        appliedSearchText = searchDraft
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        source = nil
        categoryId = nil
        exitBulkMode()
        resetLoadedState()
    }

    public func clearSearch() {
        clearSearchState()
        exitBulkMode()
        clearResults()
    }

    private func clearSearchState() {
        searchDraft = ""
        appliedSearchText = ""
    }

    public func clearResults() {
        articles = []
        page = 1
        total = 0
        totalPages = 0
        resetLoadedState()
    }

    public func load(reset: Bool) async {
        let generation: Int
        if reset {
            requestGeneration += 1
            generation = requestGeneration
            resetLoadedState()
            isLoading = true
        } else {
            generation = requestGeneration
            isRefreshing = true
            refreshErrorMessage = nil
        }

        let query = currentQuery(page: reset ? page : 1)
        let scope = LibraryCache.scope(for: query, userId: userID)
        let cachedPage = await loadCachedPage(scope: scope)
        guard requestGeneration == generation else {
            return
        }

        if reset, let cachedPage {
            apply(cachedPage, fromCache: true)
        }

        do {
            let freshPage = try await repository.load(query)
            guard requestGeneration == generation else {
                return
            }

            if userID != nil {
                try? await cache.save(freshPage, scope: scope)
            }
            guard requestGeneration == generation else {
                return
            }
            refreshErrorMessage = nil
            apply(freshPage, fromCache: false)
            await loadAuxiliaryData(generation: generation)
        } catch {
            guard requestGeneration == generation else {
                return
            }

            if let cachedPage {
                apply(cachedPage, fromCache: true)
                errorMessage = nil
            } else if !articles.isEmpty {
                errorMessage = nil
                refreshErrorMessage = Self.message(for: error)
            } else {
                errorMessage = Self.message(for: error)
                articles = []
                page = 1
                totalPages = 0
                isLoading = false
            }
        }

        if requestGeneration == generation {
            isLoading = false
            isRefreshing = false
        }
    }

    public func loadMore() async {
        guard canLoadMore else {
            return
        }

        let generation = requestGeneration
        let nextPage = page + 1
        isLoadingMore = true
        loadMoreErrorMessage = nil

        do {
            let query = LibraryQuery(
                userId: userID,
                view: view,
                searchText: appliedSearchText,
                sort: sort,
                order: order,
                source: isSourceFilterAvailable ? source : nil,
                categoryId: isSourceFilterAvailable ? categoryId : nil,
                page: nextPage,
                perPage: perPage
            )
            let nextPageResult = try await repository.load(query)
            guard requestGeneration == generation else {
                return
            }

            let scope = LibraryCache.scope(for: query, userId: userID)
            if userID != nil {
                try? await cache.save(nextPageResult, scope: scope)
            }
            var existingIDs = Set(articles.map(\.id))
            let newArticles = nextPageResult.articles.filter { article in
                existingIDs.insert(article.id).inserted
            }
            articles.append(contentsOf: newArticles)
            page = nextPageResult.page
            totalPages = nextPageResult.totalPages
        } catch {
            guard requestGeneration == generation else {
                return
            }
            loadMoreErrorMessage = "加载更多文章失败，请稍后重试"
        }

        if requestGeneration == generation {
            isLoadingMore = false
        }
    }

    public func retry() async {
        await load(reset: true)
    }

    public func prepareUser(userID: Int?, view: LibraryView) {
        requestGeneration += 1
        self.userID = userID
        searchDraft = ""
        appliedSearchText = ""
        self.view = view
        sort = ArticleSort.defaultSort(for: view)
        order = .desc
        source = nil
        categoryId = nil
        counts = nil
        availableSources = []
        sourceErrorMessage = nil
        selectedArticleID = nil
        exitBulkMode()
        resetLoadedState()
    }

    public func clearUserScope(userID: Int?) async {
        try? await cache.clear(userID: userID)
    }

    public func switchUser(userID: Int?, view: LibraryView) async {
        let previousUserID = self.userID
        prepareUser(userID: userID, view: view)
        if previousUserID != userID {
            try? await cache.clear(userID: previousUserID)
        }
        await load(reset: true)
    }

    public func toggleBulkMode() {
        if isBulkSelecting {
            exitBulkMode()
        } else {
            isBulkSelecting = true
            bulkResult = nil
        }
    }

    public func toggleBulkSelection(_ articleID: Int) {
        guard isBulkSelecting else {
            return
        }

        if bulkSelection.contains(articleID) {
            bulkSelection.remove(articleID)
        } else {
            bulkSelection.insert(articleID)
        }
    }

    public func selectAllLoadedForBulk() {
        guard isBulkSelecting else {
            return
        }

        bulkSelection = Set(articles.map(\.id))
    }

    public func invertBulkSelection() {
        guard isBulkSelecting else {
            return
        }

        bulkSelection = Set(articles.map(\.id)).subtracting(bulkSelection)
    }

    public func clearBulkResult() {
        bulkResult = nil
    }

    public func runBulkToolbarAction(
        _ action: BulkToolbarAction,
        categoryID: Int? = nil,
        obsidianDestination: URL? = nil
    ) async {
        guard bulkRunningAction == nil, isBulkSelecting else {
            return
        }
        lastBulkActionError = nil

        let articleIDs: [Int]
        do {
            articleIDs = try BulkArticlePolicy.validatedIDs(Array(bulkSelection))
        } catch {
            errorMessage = Self.message(for: error)
            return
        }

        let context = beginBulkOperation(action)
        defer { finishBulkOperation(context) }

        do {
            switch action {
            case .setCategory:
                return
            case .bulkObsidian:
                guard
                    let obsidianDestination,
                    let bulkObsidianHandler
                else {
                    return
                }
                let result = try await bulkObsidianHandler(articleIDs, obsidianDestination)
                guard isCurrentBulkOperation(context) else { return }
                bulkResult = result
            case .exportZIP:
                let job = try await bulkRepository.runCreateBulkExport(articleIDs: articleIDs)
                guard isCurrentBulkOperation(context) else { return }
                if let bulkExportHandler {
                    let url = try await bulkExportHandler(job)
                    guard isCurrentBulkOperation(context) else { return }
                    bulkExportURL = url
                }
                guard isCurrentBulkOperation(context) else { return }
                bulkResult = NativeBulkResult(
                    requestedCount: job.requestedCount,
                    succeededCount: job.succeededCount,
                    skippedCount: 0,
                    failedCount: job.failedCount,
                    issues: job.failedCount == 0 ? [] : [
                        ArticleBulkIssue(
                            articleID: 0,
                            code: "EXPORT_FAILED",
                            message: "有 \(job.failedCount) 篇文章未能导出"
                        )
                    ]
                )
            case .reclassify:
                let result = try await bulkRepository.runBulkRegenerateAI(articleIDs: articleIDs, includeCategory: true, resetUserCategory: false)
                guard isCurrentBulkOperation(context) else { return }
                bulkSelection.subtract(result.queuedIDs)
                bulkSelection.subtract(result.alreadyQueuedIDs)
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            case .generateAI:
                let result = try await bulkRepository.runBulkRegenerateAI(articleIDs: articleIDs, includeCategory: false, resetUserCategory: false)
                guard isCurrentBulkOperation(context) else { return }
                bulkSelection.subtract(result.queuedIDs)
                bulkSelection.subtract(result.alreadyQueuedIDs)
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            default:
                let result = try await bulkRepository.runBulkAction(
                    serverAction(for: action),
                    articleIDs: articleIDs,
                    categoryID: action == .archive ? categoryID : nil
                )
                guard isCurrentBulkOperation(context) else { return }
                let isDelete = action == .delete || action == .permanentDelete
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                }
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                } else if action == .archive {
                    updateArticles(withIDs: result.succeededIDs) { card in
                        replacing(card, isArchived: true, aiStatus: "queued")
                    }
                    startAIPolling()
                } else {
                    updateArticles(withIDs: result.succeededIDs, action: action)
                }
                bulkSelection.subtract(result.succeededIDs)
                bulkResult = NativeBulkResult(from: result)
                notifyCatalogAffectingChange(
                    succeededIDs: result.succeededIDs,
                    action: action
                )
            }
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    /// 单篇文章右键操作独立于批量选择，不进入多选模式。
    public func runArticleToolbarAction(
        _ action: BulkToolbarAction,
        articleID: Int,
        categoryID: Int? = nil,
        obsidianDestination: URL? = nil
    ) async {
        guard bulkRunningAction == nil else {
            return
        }
        lastBulkActionError = nil

        let articleIDs = [articleID]
        let context = beginBulkOperation(action)
        defer { finishBulkOperation(context) }

        do {
            switch action {
            case .setCategory:
                return
            case .bulkObsidian:
                guard
                    let obsidianDestination,
                    let bulkObsidianHandler
                else {
                    return
                }
                let result = try await bulkObsidianHandler(articleIDs, obsidianDestination)
                guard isCurrentBulkOperation(context) else { return }
                bulkResult = result
            case .exportZIP:
                let job = try await bulkRepository.runCreateBulkExport(articleIDs: articleIDs)
                guard isCurrentBulkOperation(context) else { return }
                if let bulkExportHandler {
                    let url = try await bulkExportHandler(job)
                    guard isCurrentBulkOperation(context) else { return }
                    bulkExportURL = url
                }
                guard isCurrentBulkOperation(context) else { return }
                bulkResult = NativeBulkResult(
                    requestedCount: job.requestedCount,
                    succeededCount: job.succeededCount,
                    skippedCount: 0,
                    failedCount: job.failedCount,
                    issues: job.failedCount == 0 ? [] : [
                        ArticleBulkIssue(
                            articleID: 0,
                            code: "EXPORT_FAILED",
                            message: "文章未能导出"
                        )
                    ]
                )
            case .reclassify:
                let result = try await bulkRepository.runBulkRegenerateAI(
                    articleIDs: articleIDs,
                    includeCategory: true,
                    resetUserCategory: false
                )
                guard isCurrentBulkOperation(context) else { return }
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            case .generateAI:
                let result = try await bulkRepository.runBulkRegenerateAI(
                    articleIDs: articleIDs,
                    includeCategory: false,
                    resetUserCategory: false
                )
                guard isCurrentBulkOperation(context) else { return }
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            default:
                let result = try await bulkRepository.runBulkAction(
                    serverAction(for: action),
                    articleIDs: articleIDs,
                    categoryID: action == .archive ? categoryID : nil
                )
                guard isCurrentBulkOperation(context) else { return }
                let isDelete = action == .delete || action == .permanentDelete
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                }
                await load(reset: false)
                guard isCurrentBulkOperation(context) else { return }
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                } else if action == .archive {
                    updateArticles(withIDs: result.succeededIDs) { card in
                        replacing(card, isArchived: true, aiStatus: "queued")
                    }
                    startAIPolling()
                } else {
                    updateArticles(withIDs: result.succeededIDs, action: action)
                }
                bulkResult = NativeBulkResult(from: result)
                notifyCatalogAffectingChange(
                    succeededIDs: result.succeededIDs,
                    action: action
                )
            }
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    public func runArticleCategoryByAI(articleID: Int) async {
        guard bulkRunningAction == nil else {
            return
        }
        lastBulkActionError = nil

        let articleIDs = [articleID]
        let context = beginBulkOperation(.setCategory)
        defer { finishBulkOperation(context) }

        do {
            let result = try await bulkRepository.runBulkRegenerateAI(
                articleIDs: articleIDs,
                includeCategory: true,
                resetUserCategory: true
            )
            guard isCurrentBulkOperation(context) else { return }
            await load(reset: false)
            guard isCurrentBulkOperation(context) else { return }
            applyAIResult(result)
            bulkResult = NativeBulkResult(from: result)
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    public func runArticleCategory(articleID: Int, category: ArticleCategory) async {
        guard bulkRunningAction == nil else {
            return
        }
        lastBulkActionError = nil

        let articleIDs = [articleID]
        let context = beginBulkOperation(.setCategory)
        defer { finishBulkOperation(context) }

        do {
            let result = try await bulkRepository.runBulkCategory(
                articleIDs: articleIDs,
                categoryID: category.id
            )
            guard isCurrentBulkOperation(context) else { return }
            await load(reset: false)
            guard isCurrentBulkOperation(context) else { return }
            updateArticles(withIDs: result.succeededIDs) { card in
                replacing(card, category: category)
            }
            bulkResult = NativeBulkResult(from: result)
            notifyCatalogAffectingChange(succeededIDs: result.succeededIDs)
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    public func runBulkCategoryByAI() async {
        guard bulkRunningAction == nil, isBulkSelecting else {
            return
        }
        lastBulkActionError = nil

        let articleIDs: [Int]
        do {
            articleIDs = try BulkArticlePolicy.validatedIDs(Array(bulkSelection))
        } catch {
            errorMessage = Self.message(for: error)
            return
        }

        let context = beginBulkOperation(.setCategory)
        defer { finishBulkOperation(context) }

        do {
            let result = try await bulkRepository.runBulkRegenerateAI(
                articleIDs: articleIDs,
                includeCategory: true,
                resetUserCategory: true
            )
            guard isCurrentBulkOperation(context) else { return }
            bulkSelection.subtract(result.queuedIDs)
            bulkSelection.subtract(result.alreadyQueuedIDs)
            await load(reset: false)
            guard isCurrentBulkOperation(context) else { return }
            applyAIResult(result)
            bulkResult = NativeBulkResult(from: result)
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    public func runBulkCategory(_ category: ArticleCategory) async {
        guard bulkRunningAction == nil, isBulkSelecting else {
            return
        }
        lastBulkActionError = nil

        let articleIDs: [Int]
        do {
            articleIDs = try BulkArticlePolicy.validatedIDs(Array(bulkSelection))
        } catch {
            errorMessage = Self.message(for: error)
            return
        }

        let context = beginBulkOperation(.setCategory)
        defer { finishBulkOperation(context) }

        do {
            let result = try await bulkRepository.runBulkCategory(
                articleIDs: articleIDs,
                categoryID: category.id
            )
            guard isCurrentBulkOperation(context) else { return }
            await load(reset: false)
            guard isCurrentBulkOperation(context) else { return }
            updateArticles(withIDs: result.succeededIDs) { card in
                replacing(card, category: category)
            }
            bulkSelection.subtract(result.succeededIDs)
            bulkResult = NativeBulkResult(from: result)
            notifyCatalogAffectingChange(succeededIDs: result.succeededIDs)
        } catch {
            guard isCurrentBulkOperation(context) else { return }
            lastBulkActionError = error as? AppError
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    private func beginBulkOperation(_ action: BulkToolbarAction) -> BulkOperationContext {
        bulkOperationID += 1
        bulkRunningAction = action
        return BulkOperationContext(
            userID: userID,
            generation: requestGeneration,
            operationID: bulkOperationID
        )
    }

    private func isCurrentBulkOperation(_ context: BulkOperationContext) -> Bool {
        userID == context.userID
            && requestGeneration == context.generation
            && bulkOperationID == context.operationID
    }

    private func finishBulkOperation(_ context: BulkOperationContext) {
        guard bulkOperationID == context.operationID else { return }
        bulkRunningAction = nil
    }

    private func exitBulkMode() {
        bulkOperationID += 1
        bulkRunningAction = nil
        isBulkSelecting = false
        bulkSelection = []
        bulkResult = nil
        lastBulkActionError = nil
        bulkExportURL = nil
    }

    private func serverAction(for action: BulkToolbarAction) -> ArticleBulkAction {
        switch action {
        case .favorite: .favorite
        case .unfavorite: .unfavorite
        case .archive: .archive
        case .unarchive: .unarchive
        case .delete: .delete
        case .permanentDelete: .permanentDelete
        case .publish: .publish
        case .unpublish: .unpublish
        case .setCategory, .reclassify, .generateAI, .exportZIP, .bulkObsidian:
            .favorite
        }
    }

    private func failedResult(articleIDs: [Int], error: any Error) -> NativeBulkResult {
        NativeBulkResult(
            requestedCount: articleIDs.count,
            succeededCount: 0,
            skippedCount: 0,
            failedCount: articleIDs.count,
            issues: [
                ArticleBulkIssue(articleID: 0, code: "REQUEST_FAILED", message: Self.message(for: error))
            ]
        )
    }

    private func removeArticles(withIDs ids: [Int]) {
        let removedIDs = Set(ids)
        articles.removeAll { removedIDs.contains($0.id) }
        bulkSelection.subtract(removedIDs)
    }

    private func updateArticles(withIDs ids: [Int], action: BulkToolbarAction) {
        updateArticles(withIDs: ids) { card in
            switch action {
            case .favorite:
                return replacing(card, isFavorited: true)
            case .unfavorite:
                return replacing(card, isFavorited: false)
            case .archive:
                return replacing(card, isArchived: true)
            case .unarchive:
                return replacing(card, isArchived: false)
            case .publish:
                return replacing(card, isPublished: true)
            case .unpublish:
                return replacing(card, isPublished: false)
            default:
                return card
            }
        }
    }

    private func updateArticles(
        withIDs ids: [Int],
        transform: (ArticleCard) -> ArticleCard
    ) {
        let changedIDs = Set(ids)
        articles = articles.map { card in
            changedIDs.contains(card.id) ? transform(card) : card
        }
    }

    private func notifyCatalogAffectingChange(
        succeededIDs: [Int],
        action: BulkToolbarAction
    ) {
        guard !succeededIDs.isEmpty, action.changesCategoryCounts else { return }
        onCatalogAffectingChange?()
    }

    private func notifyCatalogAffectingChange(succeededIDs: [Int]) {
        guard !succeededIDs.isEmpty else { return }
        onCatalogAffectingChange?()
    }

    private func applyAIResult(_ result: ArticleBulkAIResult) {
        updateArticles(withIDs: result.queuedIDs + result.alreadyQueuedIDs) { card in
            replacing(card, aiStatus: "queued")
        }
        startAIPolling()
    }

    private func replacing(
        _ card: ArticleCard,
        category: ArticleCategory? = nil,
        isFavorited: Bool? = nil,
        isArchived: Bool? = nil,
        isPublished: Bool? = nil,
        aiStatus: String? = nil
    ) -> ArticleCard {
        ArticleCard(
            id: card.id,
            title: card.title,
            author: card.author,
            source: card.source,
            originalURL: card.originalURL,
            publicID: card.publicID,
            coverImage: card.coverImage,
            publishTime: card.publishTime,
            createdAt: card.createdAt,
            aiSummary: card.aiSummary,
            aiCategory: card.aiCategory,
            aiTags: card.aiTags,
            category: category ?? card.category,
            categoryResult: card.categoryResult,
            isFavorited: isFavorited ?? card.isFavorited,
            isArchived: isArchived ?? card.isArchived,
            isPublished: isPublished ?? card.isPublished,
            aiStatus: aiStatus ?? card.aiStatus,
            aiErrorCode: card.aiErrorCode,
            aiErrorMessage: card.aiErrorMessage,
            aiModel: card.aiModel,
            aiTotalTokens: card.aiTotalTokens
        )
    }

    private func resetLoadedState() {
        stopAIPolling()
        articles = []
        page = 1
        total = 0
        totalPages = 0
        isLoading = true
        isRefreshing = false
        isLoadingMore = false
        isShowingCache = false
        errorMessage = nil
        loadMoreErrorMessage = nil
        refreshErrorMessage = nil
    }

    private func currentQuery() -> LibraryQuery {
        currentQuery(page: page)
    }

    private func currentQuery(page: Int) -> LibraryQuery {
        LibraryQuery(
            userId: userID,
            view: view,
            searchText: appliedSearchText,
            sort: sort,
            order: order,
            source: isSourceFilterAvailable ? source : nil,
            categoryId: isSourceFilterAvailable ? categoryId : nil,
            page: page,
            perPage: perPage
        )
    }

    private func apply(_ pageResult: ArticleListPage, fromCache: Bool) {
        articles = Self.deduplicated(pageResult.articles)
        page = pageResult.page
        total = pageResult.total
        totalPages = pageResult.totalPages
        isShowingCache = fromCache
        errorMessage = nil
        refreshErrorMessage = nil
        sourceErrorMessage = nil
        isLoading = false
        bulkSelection = bulkSelection.intersection(Set(articles.map(\.id)))
        scheduleAIPollingIfPending()
    }

    private func loadCachedPage(scope: LibraryCacheScope) async -> ArticleListPage? {
        guard userID != nil else {
            return nil
        }
        return try? await cache.load(scope: scope)
    }

    private func loadAuxiliaryData(generation: Int) async {
        do {
            async let loadedCounts = repository.loadCounts(userID: userID)

            if isSourceFilterAvailable {
                async let loadedSources = repository.loadSources(userID: userID)
                let sources = try await loadedSources
                if requestGeneration == generation {
                    availableSources = sources
                }
            } else if requestGeneration == generation {
                availableSources = []
            }

            if let counts = try? await loadedCounts, requestGeneration == generation {
                self.counts = counts
            }
        } catch {
            if isSourceFilterAvailable, requestGeneration == generation, availableSources.isEmpty {
                sourceErrorMessage = Self.message(for: error)
            }
        }
    }

    private func scheduleAIPollingIfPending() {
        guard articles.contains(where: { $0.aiStatus == "queued" || $0.aiStatus == "running" }) else {
            stopAIPolling()
            return
        }
        startAIPolling()
    }

    private func startAIPolling() {
        guard aiPollTask == nil else { return }
        aiPollTask = Task { [weak self] in
            defer { await MainActor.run { self?.aiPollTask = nil } }
            let startedAt = ContinuousClock.now
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self, await self.refreshAIStatusesOnce() else { break }
                if startedAt.duration(to: .now) > .seconds(90) { break }
            }
        }
    }

    private func stopAIPolling() {
        aiPollTask?.cancel()
        aiPollTask = nil
    }

    /// 列表轮询只回读当前筛选下已加载页，避免“排队中”占位一直停留。
    @discardableResult
    public func refreshAIStatusesOnce() async -> Bool {
        guard articles.contains(where: { $0.aiStatus == "queued" || $0.aiStatus == "running" }) else {
            stopAIPolling()
            return false
        }

        let pendingIDsBeforeRefresh = Set(
            articles
                .filter { $0.aiStatus == "queued" || $0.aiStatus == "running" }
                .map(\.id)
        )
        let categoryIDsBeforeRefresh = Dictionary(
            uniqueKeysWithValues: articles.map { ($0.id, $0.category?.id) }
        )
        var refreshedArticles: [ArticleCard] = []
        var refreshedPage = page
        var refreshedTotal = total
        var refreshedTotalPages = totalPages
        do {
            let pagesToRefresh = Array(1...max(1, page))
            for pageNumber in pagesToRefresh {
                let pageResult = try await repository.load(currentQuery(page: pageNumber))
                refreshedArticles.append(contentsOf: pageResult.articles)
                refreshedPage = pageResult.page
                refreshedTotal = pageResult.total
                refreshedTotalPages = pageResult.totalPages
            }
            articles = Self.deduplicated(refreshedArticles)
            page = refreshedPage
            total = refreshedTotal
            totalPages = refreshedTotalPages
            bulkSelection = bulkSelection.intersection(Set(articles.map(\.id)))
            let pendingIDsAfterRefresh = Set(
                articles
                    .filter { $0.aiStatus == "queued" || $0.aiStatus == "running" }
                    .map(\.id)
            )
            let completedAIIDs = pendingIDsBeforeRefresh.subtracting(pendingIDsAfterRefresh)
            let categoryChanged = articles.contains { article in
                categoryIDsBeforeRefresh[article.id] != article.category?.id
            }
            if !completedAIIDs.isEmpty || categoryChanged {
                onCatalogAffectingChange?()
            }
            scheduleAIPollingIfPending()
            return articles.contains(where: { $0.aiStatus == "queued" || $0.aiStatus == "running" })
        } catch {
            // 轮询失败保留当前列表，下一轮继续尝试。
            return true
        }
    }

    private static func message(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "加载资料库失败，请稍后重试"
        }

        return switch appError {
        case .network:
            "网络连接失败，请稍后重试"
        case .authenticationRequired:
            "登录已失效，请重新登录"
        case .forbidden:
            "当前账号无权访问资料库"
        case .rateLimited:
            "请求过于频繁，请稍后再试"
        case .contentUnavailable:
            "请求的资料不可用"
        case let .categoryUnavailable(message):
            message
        case let .categoryConflict(message):
            message
        case .invalidInput:
            "筛选条件无效，请调整后重试"
        case .server:
            "服务暂时不可用，请稍后重试"
        }
    }

    private static func deduplicated(_ articles: [ArticleCard]) -> [ArticleCard] {
        var seenIDs = Set<Int>()
        return articles.filter { article in
            seenIDs.insert(article.id).inserted
        }
    }
}

public extension ArticleSort {
    static func defaultSort(for view: LibraryView) -> Self {
        switch view {
        case .inbox: .collected
        case .favorites: .favorited
        case .archive: .archived
        case .published: .published
        }
    }
}

private extension BulkToolbarAction {
    var changesCategoryCounts: Bool {
        switch self {
        case .archive, .unarchive, .delete, .permanentDelete:
            true
        default:
            false
        }
    }
}
