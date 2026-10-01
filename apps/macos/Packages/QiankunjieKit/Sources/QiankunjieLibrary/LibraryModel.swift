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

    private let repository: any LibraryLoading
    private let cache: any LibraryCaching
    private var requestGeneration = 0

    public init(
        repository: any LibraryLoading = LibraryRepository(),
        cache: (any LibraryCaching)? = nil,
        userID: Int? = nil,
        view: LibraryView = .inbox
    ) {
        self.repository = repository
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
        resetLoadedState()
    }

    public func selectSort(_ sort: ArticleSort) {
        guard availableSorts.contains(sort), sort != self.sort else {
            return
        }

        self.sort = sort
        order = .desc
        resetLoadedState()
    }

    public func toggleOrder() {
        order = order == .desc ? .asc : .desc
        resetLoadedState()
    }

    public func selectSource(_ source: String?) {
        guard isSourceFilterAvailable else {
            return
        }

        let normalized = source?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.source = normalized == nil || normalized?.isEmpty == true ? nil : normalized
        resetLoadedState()
    }

    public func selectCategory(_ categoryId: Int?) {
        guard isSourceFilterAvailable else {
            return
        }

        self.categoryId = categoryId
        resetLoadedState()
    }

    public func submitSearch() {
        appliedSearchText = searchDraft
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        source = nil
        categoryId = nil
        resetLoadedState()
    }

    public func clearSearch() {
        searchDraft = ""
        appliedSearchText = ""
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
