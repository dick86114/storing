import Foundation
import Observation
import QiankunjieCore
import QiankunjieNetworking

public protocol ReaderNetworkClient: Sendable {
    func articleDetail(
        _ selection: ReaderSelection
    ) async throws -> ArticleDetail
    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult
    func archive(articleID: Int, categoryID: Int?) async throws -> ReaderArchiveResult
    func unarchive(articleID: Int) async throws -> ReaderArchiveResult
    func publish(articleID: Int) async throws -> ReaderPublicationResult
    func unpublish(articleID: Int) async throws -> ReaderPublicationResult
    func refetch(articleID: Int) async throws -> ReaderRefetchResult
    func regenerateAI(articleID: Int) async throws -> ReaderAIResult
    func classifyArticle(articleID: Int) async throws -> ReaderAIResult
    func delete(articleID: Int) async throws -> ReaderDeleteResult
    func permanentDelete(articleID: Int) async throws
    func renameArticle(articleID: Int, title: String) async throws
    func moveArticleToCategory(articleID: Int, categoryID: Int) async throws
}

/// 列表选择同时保留内部 ID 和公开令牌，避免游客公开阅读丢失路由。
public struct ReaderSelection: Hashable, Sendable {
    public let articleID: Int
    public let publicID: String?
    public let isGuest: Bool

    public init(
        articleID: Int,
        publicID: String?,
        isGuest: Bool
    ) {
        let normalizedPublicID = publicID?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.articleID = articleID
        self.publicID = normalizedPublicID?.isEmpty == false ? normalizedPublicID : nil
        self.isGuest = isGuest
    }
}

private struct ReaderPublicArticleEnvelope: Decodable {
    let article: ArticleDetail
}

public struct ReaderActionAvailability: Equatable, Sendable {
    public let allowsAccountActions: Bool
    public let originalURL: URL?
}

public enum ReaderActionPolicy {
    public static func availability(
        articleID: Int?,
        isGuest: Bool,
        isPerformingAction: Bool,
        originalURLText: String?
    ) -> ReaderActionAvailability {
        let allowsAccountActions = articleID != nil
            && !isGuest
            && !isPerformingAction
        let originalURL = safeOriginalURL(
            from: originalURLText,
            isPerformingAction: isPerformingAction
        )

        return ReaderActionAvailability(
            allowsAccountActions: allowsAccountActions,
            originalURL: originalURL
        )
    }

    private static func safeOriginalURL(
        from text: String?,
        isPerformingAction: Bool
    ) -> URL? {
        guard
            !isPerformingAction,
            let text,
            let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
            ReaderNavigationPolicy.decision(for: url) == .openExternally
        else {
            return nil
        }

        return url
    }
}

public struct ReaderFavoriteResult: Decodable, Sendable {
    public let isFavorited: Bool

    public init(isFavorited: Bool) {
        self.isFavorited = isFavorited
    }
}

public struct ReaderArchiveResult: Decodable, Sendable {
    public let isArchived: Bool
    public let category: ArticleCategory?

    public init(isArchived: Bool, category: ArticleCategory? = nil) {
        self.isArchived = isArchived
        self.category = category
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        isArchived = try container.decode(Bool.self, forKey: .isArchived)
        category = try container.decodeIfPresent(ArticleCategory.self, forKey: .category)
    }

    enum CodingKeys: String, CodingKey {
        case isArchived
        case category
    }
}

public struct ReaderPublicationResult: Decodable, Sendable {
    public let article: ArticleDetail?
    public let publicURL: String?

    public init(article: ArticleDetail?, publicURL: String?) {
        self.article = article
        self.publicURL = publicURL
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        article = try container.decodeIfPresent(ArticleDetail.self, forKey: .article)
        publicURL = try container.decodeIfPresent(String.self, forKey: .publicURL)
    }

    enum CodingKeys: String, CodingKey {
        case article
        case publicURL = "publicUrl"
    }
}

public struct ReaderRefetchResult: Decodable, Sendable {
    public let hasHTML: Bool

    public init(hasHTML: Bool) {
        self.hasHTML = hasHTML
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hasHTML = try container.decode(Bool.self, forKey: .hasHTML)
    }

    enum CodingKeys: String, CodingKey {
        case hasHTML = "contentHtml"
    }
}

public struct ReaderAIResult: Decodable, Sendable {
    public let ok: Bool

    public init(ok: Bool) {
        self.ok = ok
    }
}

private struct ArchiveRequest: Encodable, Sendable {
    let categoryID: Int?

    enum CodingKeys: String, CodingKey {
        case categoryID = "categoryId"
    }
}

private struct ClassifyRequest: Encodable, Sendable {
    let overrideUserCategory = true
}

public struct ReaderDeleteResult: Decodable, Sendable {
    public let deleted: Bool

    public init(deleted: Bool) {
        self.deleted = deleted
    }
}

public protocol ReaderPositionStoring: Sendable {
    func readingState(articleID: Int) -> Data?
    func save(_ state: Data, articleID: Int)
    func remove(articleID: Int)
    func prepareUser(userID: Int?)
}

/// UserDefaults 自身线程安全；这里只保存文章独立的阅读状态。
public final class ReaderPositionStore: ReaderPositionStoring, @unchecked Sendable {
    private let defaults: UserDefaults
    private var userID: Int?

    public init(defaults: UserDefaults = .standard, userID: Int? = nil) {
        self.defaults = defaults
        self.userID = userID
        removeLegacyKeys(in: defaults)
    }

    public func readingState(articleID: Int) -> Data? {
        defaults.data(forKey: Self.key(articleID, userID: userID))
    }

    public func save(_ state: Data, articleID: Int) {
        defaults.set(state, forKey: Self.key(articleID, userID: userID))
    }

    public func remove(articleID: Int) {
        defaults.removeObject(forKey: Self.key(articleID, userID: userID))
    }

    public func prepareUser(userID: Int?) {
        guard self.userID != userID else { return }
        clear(userID: self.userID)
        self.userID = userID
    }

    private func clear(userID: Int?) {
        let prefix = Self.scopePrefix(userID: userID)
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(prefix) {
            defaults.removeObject(forKey: key)
        }
    }

    private func removeLegacyKeys(in defaults: UserDefaults) {
        let prefix = "qiankunjie.reader.readingPosition."
        for key in defaults.dictionaryRepresentation().keys
        where Self.isLegacyReadingPositionKey(key, prefix: prefix) {
            defaults.removeObject(forKey: key)
        }
    }

    private static func isLegacyReadingPositionKey(_ key: String, prefix: String) -> Bool {
        guard key.hasPrefix(prefix) else { return false }

        let articleID = key.dropFirst(prefix.count)
        return !articleID.isEmpty && articleID.allSatisfy { ("0"..."9").contains($0) }
    }

    private static func scopePrefix(userID: Int?) -> String {
        "qiankunjie.reader.readingPosition.user.\(userID ?? -1)."
    }

    private static func key(_ articleID: Int, userID: Int?) -> String {
        "\(scopePrefix(userID: userID))article.\(articleID)"
    }
}

public struct ReaderArticle: Sendable {
    public let detail: ArticleDetail
    public var isFavorited: Bool
    public var isArchived: Bool
    public var isPublished: Bool
    public var category: ArticleCategory?

    public init(detail: ArticleDetail) {
        self.detail = detail
        isFavorited = detail.isFavorited
        isArchived = detail.isArchived
        isPublished = detail.isPublished
        category = detail.category
    }

    public var id: Int { detail.id }
    public var title: String? { detail.title }
    public var author: String? { detail.author }
    public var source: String? { detail.source }
    public var originalURL: String? { detail.originalURL }
    public var coverImage: String? { detail.coverImage }
    public var publishTime: Date? { detail.publishTime }
    public var createdAt: Date? { detail.createdAt }
    public var aiSummary: String? { detail.aiSummary }
    public var aiCategory: String? { detail.aiCategory }
    public var aiTags: [String] { detail.aiTags }
    public var categoryResult: ArticleCategoryResult? { detail.categoryResult }
    public var contentHTML: String? { detail.contentHTML }
    public var contentMarkdown: String? { detail.contentMarkdown }
}

extension ReaderArticle {
    /// 动作会更新收藏、归档、分类等可变状态，缓存时合并为最新详情。
    func detailForCache(title: String?) -> ArticleDetail {
        ArticleDetail(
            id: detail.id,
            title: title ?? detail.title,
            author: detail.author,
            source: detail.source,
            originalURL: detail.originalURL,
            publicID: detail.publicID,
            coverImage: detail.coverImage,
            publishTime: detail.publishTime,
            createdAt: detail.createdAt,
            aiSummary: detail.aiSummary,
            aiCategory: detail.aiCategory,
            aiTags: detail.aiTags,
            category: category,
            categoryResult: detail.categoryResult,
            isFavorited: isFavorited,
            isArchived: isArchived,
            isPublished: isPublished,
            contentHTML: detail.contentHTML,
            contentMarkdown: detail.contentMarkdown,
            aiStatus: detail.aiStatus,
            aiErrorCode: detail.aiErrorCode,
            aiErrorMessage: detail.aiErrorMessage,
            aiModel: detail.aiModel,
            aiTotalTokens: detail.aiTotalTokens
        )
    }
}

@MainActor
@Observable
public final class ReaderModel {
    public private(set) var article: ReaderArticle?
    public private(set) var articleID: Int?
    /// 用户手动修改后的标题，优先于服务端详情标题展示。
    public private(set) var titleOverride: String?
    public private(set) var selection: ReaderSelection?
    public private(set) var isLoading = false
    public private(set) var isPerformingAction = false
    public private(set) var isDeleted = false
    public private(set) var errorMessage: String?
    public private(set) var actionErrorMessage: String?
    /// 保留结构化错误类别，供分类选择器区分文章失效与普通失败。
    public private(set) var actionError: AppError?
    public private(set) var contentToken = ""
    public private(set) var savedReadingState: Data?
    public var onDeleted: (() -> Void)?
    @ObservationIgnored public var onCategoryAffectingChange: (() -> Void)?

    private let client: any ReaderNetworkClient
    private let positionStore: any ReaderPositionStoring
    private let articleCache: any ReaderArticleCaching
    public private(set) var userID: Int?
    private var requestGeneration = 0
    private var actionGeneration = 0
    private var aiPollTask: Task<Void, Never>?

    public init(
        client: any ReaderNetworkClient = APIClient(),
        positionStore: any ReaderPositionStoring = ReaderPositionStore(),
        articleCache: any ReaderArticleCaching = EmptyReaderArticleCache(),
        userID: Int? = nil
    ) {
        self.client = client
        self.positionStore = positionStore
        self.articleCache = articleCache
        self.userID = userID
        positionStore.prepareUser(userID: userID)
    }

    public func prepareUser(userID: Int?) {
        guard self.userID != userID else { return }
        positionStore.prepareUser(userID: userID)
        actionGeneration += 1
        self.userID = userID
        article = nil
        articleID = nil
        selection = nil
        savedReadingState = nil
        isPerformingAction = false
        actionError = nil
        actionErrorMessage = nil
        stopAIPolling()
    }

    public var displayHTML: String {
        guard let article else {
            return ReaderHTMLDocument.empty
        }

        if let html = article.contentHTML?.trimmingCharacters(in: .whitespacesAndNewlines),
           !html.isEmpty {
            return ReaderHTMLDocument.insertingCover(article.coverImage, into: html)
        }

        return ReaderHTMLDocument.insertingCover(
            article.coverImage,
            into: ReaderHTMLDocument.fallback(for: article.detail)
        )
    }

    public func open(_ selection: ReaderSelection) async {
        actionGeneration += 1
        requestGeneration += 1
        stopAIPolling()
        await load(selection, requestGeneration: requestGeneration)
    }

    public func open(articleID: Int) async {
        await open(
            ReaderSelection(
                articleID: articleID,
                publicID: nil,
                isGuest: false
            )
        )
    }

    private func load(
        _ selection: ReaderSelection,
        requestGeneration generation: Int,
        ignoresCache: Bool = false
    ) async {
        self.articleID = selection.articleID
        self.selection = selection
        titleOverride = nil
        isDeleted = false
        isLoading = true
        errorMessage = nil
        actionErrorMessage = nil
        actionError = nil
        savedReadingState = positionStore.readingState(
            articleID: selection.articleID
        )

        if !ignoresCache {
            let cached = try? await articleCache.load(
                selection: selection,
                userID: userID
            )
            if
                let cached,
                requestGeneration == generation,
                cached.id == selection.articleID
            {
                article = ReaderArticle(detail: cached)
                contentToken = UUID().uuidString
                errorMessage = nil
                isLoading = false
                scheduleAIPollingIfPending()
                return
            }
        }

        do {
            let detail = try await client.articleDetail(selection)
            guard requestGeneration == generation else {
                return
            }

            article = ReaderArticle(detail: detail)
            contentToken = UUID().uuidString
            errorMessage = nil
            scheduleAIPollingIfPending()
            isLoading = false
            try? await articleCache.save(
                detail,
                selection: selection,
                userID: userID
            )
        } catch {
            guard requestGeneration == generation else {
                return
            }
            errorMessage = Self.message(for: error)
        }

        if requestGeneration == generation {
            isLoading = false
        }
    }

    public func updateReadingState(
        _ state: Data,
        contentToken: String? = nil
    ) {
        guard let articleID else {
            return
        }
        guard contentToken == nil || contentToken == self.contentToken else {
            return
        }

        savedReadingState = state
        positionStore.save(state, articleID: articleID)
    }

    public func toggleFavorite() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.toggleFavorite(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.article?.isFavorited = result.isFavorited
        }
    }

    @discardableResult
    public func archive(categoryID: Int? = nil) async -> Bool {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.archive(
                articleID: articleID,
                categoryID: categoryID
            )
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.article?.isArchived = result.isArchived
            if let category = result.category {
                self.article?.category = category
            }
            self.startAIPolling()
            self.onCategoryAffectingChange?()
        }
    }

    public func moveToInbox() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.unarchive(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.article?.isArchived = result.isArchived
            self.onCategoryAffectingChange?()
        }
    }

    public func publish() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.publish(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.applyPublication(result, published: true)
        }
    }

    public func unpublish() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.unpublish(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.applyPublication(result, published: false)
        }
    }

    public func refetch() async {
        await performAction { articleID, _ in
            _ = try await self.client.refetch(articleID: articleID)
            await self.reloadCurrentArticle()
        }
    }

    public func regenerateAI() async {
        await performAction { articleID, _ in
            _ = try await self.client.regenerateAI(articleID: articleID)
            await self.reloadCurrentArticle()
            self.startAIPolling()
        }
    }

    @discardableResult
    public func classifyArticle() async -> Bool {
        await performAction { articleID, actionGeneration in
            _ = try await self.client.classifyArticle(articleID: articleID)
            await self.reloadCurrentArticle()
            guard self.isCurrentAction(actionGeneration) else { return }
            self.startAIPolling()
            self.onCategoryAffectingChange?()
        }
    }

    public func delete() async {
        await performAction { articleID, actionGeneration in
            do {
                let result = try await self.client.delete(articleID: articleID)
                guard result.deleted, isCurrentAction(actionGeneration) else { return }
            } catch AppError.contentUnavailable {
                // 文章已不存在时按删除完成收尾，避免阅读器停留在一篇已删文章上。
            }
            if isCurrentAction(actionGeneration) {
                self.isDeleted = true
                self.positionStore.remove(articleID: articleID)
                await self.removeCachedArticle()
                self.onDeleted?()
                self.onCategoryAffectingChange?()
            }
        }
    }

    public func deletePermanent() async {
        await performAction { articleID, actionGeneration in
            do {
                try await self.client.permanentDelete(articleID: articleID)
            } catch AppError.contentUnavailable {
                // 首次请求可能已删除成功但响应丢失；404 视为已彻底删除。
            }
            if isCurrentAction(actionGeneration) {
                self.isDeleted = true
                self.positionStore.remove(articleID: articleID)
                await self.removeCachedArticle()
                self.onDeleted?()
                self.onCategoryAffectingChange?()
            }
        }
    }

    public func moveToCategory(_ categoryID: Int) async -> Bool {
        await performAction { articleID, actionGeneration in
            try await self.client.moveArticleToCategory(articleID: articleID, categoryID: categoryID)
            guard self.isCurrentAction(actionGeneration) else { return }
            await self.reloadCurrentArticle()
            self.onCategoryAffectingChange?()
        }
    }

    /// 归档后的 AI 任务是后台完成的；阅读器需要定时回读，不能永远停留“生成中”。
    private func scheduleAIPollingIfPending() {
        guard let article, article.detail.aiStatus == "queued" || article.detail.aiStatus == "running" else {
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
                guard let self, await self.refreshAIStatusOnce() else { break }
                if startedAt.duration(to: .now) > .seconds(90) { break }
            }
        }
    }

    private func stopAIPolling() {
        aiPollTask?.cancel()
        aiPollTask = nil
    }

    @discardableResult
    public func refreshAIStatusOnce() async -> Bool {
        guard let selection, let currentArticle = article else { return false }
        let previousStatus = currentArticle.detail.aiStatus
        let previousCategoryID = currentArticle.category?.id

        do {
            let detail = try await client.articleDetail(selection)
            guard articleID == selection.articleID, article?.id == currentArticle.id else { return false }
            article = ReaderArticle(detail: detail)
            errorMessage = nil
            try? await articleCache.save(
                detail,
                selection: selection,
                userID: userID
            )
            let status = detail.aiStatus
            let wasPending = previousStatus == "queued" || previousStatus == "running"
            let isPending = status == "queued" || status == "running"
            if (wasPending && !isPending) || previousCategoryID != article?.category?.id {
                onCategoryAffectingChange?()
            }
            return status == "queued" || status == "running"
        } catch {
            // 轮询失败不打断阅读，下一轮或手动刷新再尝试。
            return true
        }
    }

    private func applyPublication(
        _ result: ReaderPublicationResult,
        published: Bool
    ) {
        article?.isPublished = result.article?.isPublished ?? published
    }

    @discardableResult
    private func performAction(
        _ action: (Int, Int) async throws -> Void
    ) async -> Bool {
        guard let selection, !isPerformingAction else {
            return false
        }

        let articleID = selection.articleID
        actionGeneration += 1
        let generation = actionGeneration
        isPerformingAction = true
        actionErrorMessage = nil
        actionError = nil
        defer {
            if isCurrentAction(generation) {
                isPerformingAction = false
            }
        }

        do {
            try await action(articleID, generation)
            guard isCurrentAction(generation) else {
                return false
            }
            await saveCurrentArticleToCache()
            return true
        } catch {
            guard isCurrentAction(generation) else {
                return false
            }
            actionError = error as? AppError
            actionErrorMessage = Self.message(for: error)
            return false
        }
    }

    private func reloadCurrentArticle() async {
        guard let selection else {
            return
        }

        requestGeneration += 1
        await load(
            selection,
            requestGeneration: requestGeneration,
            ignoresCache: true
        )
    }

    private func saveCurrentArticleToCache() async {
        guard let article, let selection, !isDeleted else {
            return
        }
        let detail = article.detailForCache(title: titleOverride)
        try? await articleCache.save(
            detail,
            selection: selection,
            userID: userID
        )
    }

    private func removeCachedArticle() async {
        guard let selection else {
            return
        }
        try? await articleCache.remove(
            selection: selection,
            userID: userID
        )
    }

    private func isCurrentAction(_ generation: Int) -> Bool {
        actionGeneration == generation
    }

    private static func message(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "文章操作失败，请稍后重试"
        }

        return switch appError {
        case .network:
            "网络连接失败，请稍后重试"
        case .authenticationRequired:
            "登录已失效，请重新登录"
        case .forbidden:
            "当前账号无权执行该操作"
        case .rateLimited:
            "操作过于频繁，请稍后再试"
        case .contentUnavailable:
            "请求的文章不可用"
        case let .categoryUnavailable(message):
            message
        case let .categoryConflict(message):
            message
        case .invalidInput:
            "文章请求无效，请刷新后重试"
        case let .serverMessage(message):
            message
        case .server:
            "服务暂时不可用，请稍后重试"
        }
    }
}

/// 服务端 HTML 缺失时保留元信息和可读文本，不伪造抓取结果。
enum ReaderHTMLDocument {
    static let empty = fallbackDocument(
        title: "未选择文章",
        source: nil,
        summary: nil,
        bodyText: nil,
        bodyMessage: "请从左侧列表选择一篇文章"
    )

    static func fallback(for article: ArticleDetail) -> String {
        let bodyText = article.contentMarkdown?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let summary = article.aiSummary ?? article.aiCategory
        let hasBody = bodyText?.isEmpty == false

        return fallbackDocument(
            title: article.title ?? "未命名文章",
            source: article.source,
            summary: summary,
            bodyText: hasBody ? bodyText : nil,
            bodyMessage: hasBody ? nil : "暂无正文，请重新抓取"
        )
    }

    static func insertingCover(
        _ coverImage: String?,
        into html: String
    ) -> String {
        guard
            let coverImage,
            !coverImage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return html
        }

        let cover = """
        <figure class="storing-cover">
          <img src="\(escaped(coverImage))" alt="文章封面" loading="eager" decoding="async">
        </figure>
        """

        guard let bodyStart = html.range(
            of: "<body",
            options: [.caseInsensitive, .regularExpression]
        ) else {
            return cover + html
        }

        guard let bodyTagEnd = html[bodyStart.upperBound...].firstIndex(of: ">") else {
            return cover + html
        }

        let insertionIndex = html.index(after: bodyTagEnd)
        return html[..<insertionIndex] + "\n" + cover + html[insertionIndex...]
    }

    private static func fallbackDocument(
        title: String,
        source: String?,
        summary: String?,
        bodyText: String?,
        bodyMessage: String?
    ) -> String {
        let sections = [
            summarySection(summary),
            bodySection(bodyText, message: bodyMessage),
        ]
            .filter { !$0.isEmpty }
            .joined(separator: "\n")

        return """
        <!doctype html>
        <html lang="zh-CN">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>\(escaped(title))</title>
          <style>
            body { margin: 0; padding: 32px; font: 17px/1.75 -apple-system, sans-serif; color: #1d1d1f; background: #ffffff; }
            main { max-width: 720px; margin: 0 auto; }
            h1 { font-size: 28px; line-height: 1.25; margin: 0 0 8px; }
            p { margin: 0 0 18px; }
            .meta { color: #6e6e73; font-size: 14px; }
            .summary { padding: 16px; border-left: 3px solid #3478f6; background: #f5f5f7; }
          </style>
        </head>
        <body><main>
          <h1>\(escaped(title))</h1>
          <p class="meta">\(source.map { "来源：\(escaped($0))" } ?? "乾坤戒")</p>
          \(sections)
        </main></body></html>
        """
    }

    private static func summarySection(_ summary: String?) -> String {
        guard let text = summary?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            return ""
        }
        return "<section class=\"summary\">\(escaped(text))</section>"
    }

    private static func bodySection(_ text: String?, message: String?) -> String {
        if let text {
            let paragraphs = text.components(separatedBy: "\n\n")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .map { "<p>\(escaped($0).replacingOccurrences(of: "\\n", with: "<br />"))</p>" }
                .joined(separator: "\n")
            if !paragraphs.isEmpty {
                return "<article>\(paragraphs)</article>"
            }
        }

        guard let message else {
            return ""
        }
        return "<article><p>\(escaped(message))</p></article>"
    }

    private static func escaped(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

extension APIClient: ReaderNetworkClient {
    private struct ReaderRenameEnvelope: Decodable {
        let articleId: Int
        let title: String
    }

private struct ReaderPermanentDeleteEnvelope: Decodable {
    let articleId: Int
    let deleted: Bool
}

private struct ReaderCategoryUpdateEnvelope: Decodable {
    let articleId: Int
    let updatedCount: Int
}

    public func permanentDelete(articleID: Int) async throws {
        let _: ReaderPermanentDeleteEnvelope = try await send(
            .delete("articles/\(articleID)/permanent"),
            authenticated: true
        )
    }

    public func renameArticle(articleID: Int, title: String) async throws {
        let body = try JSONEncoder().encode(["title": title])
        let _: ReaderRenameEnvelope = try await send(
            .patch("articles/\(articleID)/title", body: body),
            authenticated: true
        )
    }

    public func moveArticleToCategory(articleID: Int, categoryID: Int) async throws {
        let body = try JSONEncoder().encode(["categoryId": categoryID])
        let _: ReaderCategoryUpdateEnvelope = try await send(
            .patch("articles/\(articleID)/category", body: body),
            authenticated: true
        )
    }

    public func articleDetail(
        _ selection: ReaderSelection
    ) async throws -> ArticleDetail {
        if
            selection.isGuest,
            let publicID = selection.publicID
        {
            let encodedPublicID = publicID.addingPercentEncoding(
                withAllowedCharacters: .urlPathAllowed
            ) ?? publicID
            let publication: ReaderPublicArticleEnvelope = try await send(
                .get("publications/\(encodedPublicID)"),
                authenticated: false
            )
            return publication.article
        }

        return try await send(
            .get(
                "articles/\(selection.articleID)",
                queryItems: [
                    URLQueryItem(name: "format", value: "html"),
                    URLQueryItem(name: "htmlVariant", value: "desktop"),
                ]
            ),
            authenticated: true
        )
    }

    public func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        try await send(.post("articles/\(articleID)/favorite"), authenticated: true)
    }

    public func archive(articleID: Int, categoryID: Int?) async throws -> ReaderArchiveResult {
        try await send(
            .post(
                "articles/\(articleID)/archive",
                body: try JSONEncoder.qiankunjie.encode(ArchiveRequest(categoryID: categoryID))
            ),
            authenticated: true
        )
    }

    public func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        try await send(.post("articles/\(articleID)/unarchive"), authenticated: true)
    }

    public func publish(articleID: Int) async throws -> ReaderPublicationResult {
        try await send(.post("articles/\(articleID)/publish"), authenticated: true)
    }

    public func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        try await send(.post("articles/\(articleID)/unpublish"), authenticated: true)
    }

    public func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        try await send(.post("articles/\(articleID)/refetch"), authenticated: true)
    }

    public func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        try await send(.post("articles/\(articleID)/regenerate-ai"), authenticated: true)
    }

    public func classifyArticle(articleID: Int) async throws -> ReaderAIResult {
        try await send(
            .post(
                "articles/\(articleID)/classify",
                body: try JSONEncoder.qiankunjie.encode(ClassifyRequest())
            ),
            authenticated: true
        )
    }

    public func delete(articleID: Int) async throws -> ReaderDeleteResult {
        try await send(.delete("articles/\(articleID)"), authenticated: true)
    }
}

extension ReaderModel {
    /// 修改文章标题：服务端保存成功后更新本地展示，并回读失败原因。
    public func rename(title: String) async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let article, !trimmed.isEmpty, trimmed != (titleOverride ?? article.title ?? "") else { return }
        do {
            try await client.renameArticle(articleID: article.id, title: trimmed)
            titleOverride = trimmed
            errorMessage = nil
            await saveCurrentArticleToCache()
        } catch {
            errorMessage = Self.message(for: error)
        }
    }
}
