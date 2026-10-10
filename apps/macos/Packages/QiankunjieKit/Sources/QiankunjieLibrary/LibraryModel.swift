import Foundation
import Observation
import QiankunjieCore

public enum LibraryDisplayState: Equatable, Sendable {
    case loading
    case content
    case empty
    case error
}

@MainActor
@Observable
public final class LibraryModel {
    public var selectedArticleID: Int?
    public var searchDraft: String = ""
    public private(set) var userID: Int?
    public private(set) var view: LibraryView = .inbox
    public private(set) var appliedSearchText = ""
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
    public private(set) var availableCategories: [LibraryCategoryFilter] = []
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

    private let repository: any LibraryLoading
    private let bulkRepository: any LibraryBulkOperating
    private let cache: any LibraryCaching
    private var requestGeneration = 0

    public init(
        repository: any LibraryLoading = LibraryRepository(),
        bulkRepository: any LibraryBulkOperating = LibraryRepository(),
        cache: (any LibraryCaching)? = nil,
        userID: Int? = nil,
        view: LibraryView = .inbox
    ) {
        self.repository = repository
        self.bulkRepository = bulkRepository
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

    public var selectedCategory: LibraryCategoryFilter? {
        availableCategories.first { $0.id == categoryId }
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
        guard view != self.view else {
            return
        }

        self.view = view
        sort = ArticleSort.defaultSort(for: view)
        order = .desc
        source = nil
        categoryId = nil
        availableSources = []
        availableCategories = []
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
        searchDraft = ""
        appliedSearchText = ""
        exitBulkMode()
        clearResults()
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
        availableCategories = []
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

    public func runBulkToolbarAction(_ action: BulkToolbarAction) async {
        guard bulkRunningAction == nil, isBulkSelecting else {
            return
        }

        let articleIDs: [Int]
        do {
            articleIDs = try BulkArticlePolicy.validatedIDs(Array(bulkSelection))
        } catch {
            errorMessage = Self.message(for: error)
            return
        }

        bulkRunningAction = action
        defer {
            bulkRunningAction = nil
        }

        do {
            switch action {
            case .setCategory, .exportZIP, .bulkObsidian:
                return
            case .reclassify:
                let result = try await bulkRepository.runBulkRegenerateAI(articleIDs: articleIDs, includeCategory: true)
                bulkSelection.subtract(result.queuedIDs)
                bulkSelection.subtract(result.alreadyQueuedIDs)
                await load(reset: false)
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            case .generateAI:
                let result = try await bulkRepository.runBulkRegenerateAI(articleIDs: articleIDs, includeCategory: false)
                bulkSelection.subtract(result.queuedIDs)
                bulkSelection.subtract(result.alreadyQueuedIDs)
                await load(reset: false)
                applyAIResult(result)
                bulkResult = NativeBulkResult(from: result)
            default:
                let result = try await bulkRepository.runBulkAction(serverAction(for: action), articleIDs: articleIDs)
                let isDelete = action == .delete || action == .permanentDelete
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                }
                await load(reset: false)
                if isDelete {
                    removeArticles(withIDs: result.succeededIDs)
                } else {
                    updateArticles(withIDs: result.succeededIDs, action: action)
                }
                bulkSelection.subtract(result.succeededIDs)
                bulkResult = NativeBulkResult(from: result)
            }
        } catch {
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    public func runBulkCategory(_ categoryID: Int) async {
        guard bulkRunningAction == nil, isBulkSelecting else {
            return
        }

        let articleIDs: [Int]
        do {
            articleIDs = try BulkArticlePolicy.validatedIDs(Array(bulkSelection))
        } catch {
            errorMessage = Self.message(for: error)
            return
        }

        bulkRunningAction = .setCategory
        defer {
            bulkRunningAction = nil
        }

        do {
            let result = try await bulkRepository.runBulkCategory(articleIDs: articleIDs, categoryID: categoryID)
            await load(reset: false)
            let category = availableCategories.first { $0.id == categoryID }?.category
            updateArticles(withIDs: result.succeededIDs) { card in
                var updated = card
                if let category {
                    updated = ArticleCard(
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
                        category: category,
                        categoryResult: card.categoryResult,
                        isFavorited: card.isFavorited,
                        isArchived: card.isArchived,
                        isPublished: card.isPublished,
                        aiStatus: card.aiStatus,
                        aiErrorCode: card.aiErrorCode,
                        aiErrorMessage: card.aiErrorMessage,
                        aiModel: card.aiModel,
                        aiTotalTokens: card.aiTotalTokens
                    )
                }
                return updated
            }
            bulkSelection.subtract(result.succeededIDs)
            bulkResult = NativeBulkResult(from: result)
        } catch {
            bulkResult = failedResult(articleIDs: articleIDs, error: error)
        }
    }

    private func exitBulkMode() {
        isBulkSelecting = false
        bulkSelection = []
        bulkResult = nil
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

    private func applyAIResult(_ result: ArticleBulkAIResult) {
        updateArticles(withIDs: result.queuedIDs + result.alreadyQueuedIDs) { card in
            replacing(card, aiStatus: "queued")
        }
    }

    private func replacing(
        _ card: ArticleCard,
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
            category: card.category,
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

            if isSourceFilterAvailable {
                async let loadedCategories = repository.loadCategoryFilters(userID: userID)
                let categories = try await loadedCategories
                if requestGeneration == generation {
                    availableCategories = categories
                }
            } else if requestGeneration == generation {
                availableCategories = []
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
