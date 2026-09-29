import Foundation
import Observation
import QiankunjieCore
import QiankunjieNetworking

public protocol ReaderNetworkClient: Sendable {
    func articleDetail(
        _ selection: ReaderSelection
    ) async throws -> ArticleDetail
    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult
    func archive(articleID: Int) async throws -> ReaderArchiveResult
    func unarchive(articleID: Int) async throws -> ReaderArchiveResult
    func publish(articleID: Int) async throws -> ReaderPublicationResult
    func unpublish(articleID: Int) async throws -> ReaderPublicationResult
    func refetch(articleID: Int) async throws -> ReaderRefetchResult
    func regenerateAI(articleID: Int) async throws -> ReaderAIResult
    func delete(articleID: Int) async throws -> ReaderDeleteResult
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

    public init(isArchived: Bool) {
        self.isArchived = isArchived
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
}

/// UserDefaults 自身线程安全；这里只保存文章独立的阅读状态。
public final class ReaderPositionStore: ReaderPositionStoring, @unchecked Sendable {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func readingState(articleID: Int) -> Data? {
        defaults.data(forKey: Self.key(articleID))
    }

    public func save(_ state: Data, articleID: Int) {
        defaults.set(state, forKey: Self.key(articleID))
    }

    public func remove(articleID: Int) {
        defaults.removeObject(forKey: Self.key(articleID))
    }

    private static func key(_ articleID: Int) -> String {
        "qiankunjie.reader.readingPosition.\(articleID)"
    }
}

public struct ReaderArticle: Sendable {
    public let detail: ArticleDetail
    public var isFavorited: Bool
    public var isArchived: Bool
    public var isPublished: Bool

    public init(detail: ArticleDetail) {
        self.detail = detail
        isFavorited = detail.isFavorited
        isArchived = detail.isArchived
        isPublished = detail.isPublished
    }

    public var id: Int { detail.id }
    public var title: String? { detail.title }
    public var author: String? { detail.author }
    public var source: String? { detail.source }
    public var originalURL: String? { detail.originalURL }
    public var publishTime: Date? { detail.publishTime }
    public var createdAt: Date? { detail.createdAt }
    public var aiSummary: String? { detail.aiSummary }
    public var aiCategory: String? { detail.aiCategory }
    public var aiTags: [String] { detail.aiTags }
    public var contentHTML: String? { detail.contentHTML }
    public var contentMarkdown: String? { detail.contentMarkdown }
}

@MainActor
@Observable
public final class ReaderModel {
    public private(set) var article: ReaderArticle?
    public private(set) var articleID: Int?
    public private(set) var selection: ReaderSelection?
    public private(set) var isLoading = false
    public private(set) var isPerformingAction = false
    public private(set) var isDeleted = false
    public private(set) var errorMessage: String?
    public private(set) var actionErrorMessage: String?
    public private(set) var contentToken = ""
    public private(set) var savedReadingState: Data?
    public var onDeleted: (() -> Void)?

    private let client: any ReaderNetworkClient
    private let positionStore: any ReaderPositionStoring
    private var requestGeneration = 0
    private var actionGeneration = 0

    public init(
        client: any ReaderNetworkClient = APIClient(),
        positionStore: any ReaderPositionStoring = ReaderPositionStore()
    ) {
        self.client = client
        self.positionStore = positionStore
    }

    public var displayHTML: String {
        guard let article else {
            return ReaderHTMLDocument.empty
        }

        if let html = article.contentHTML?.trimmingCharacters(in: .whitespacesAndNewlines),
           !html.isEmpty {
            return html
        }

        return ReaderHTMLDocument.fallback(for: article.detail)
    }

    public func open(_ selection: ReaderSelection) async {
        actionGeneration += 1
        requestGeneration += 1
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
        requestGeneration generation: Int
    ) async {
        self.articleID = selection.articleID
        self.selection = selection
        isDeleted = false
        isLoading = true
        errorMessage = nil
        actionErrorMessage = nil
        savedReadingState = positionStore.readingState(
            articleID: selection.articleID
        )

        do {
            let detail = try await client.articleDetail(selection)
            guard requestGeneration == generation else {
                return
            }

            article = ReaderArticle(detail: detail)
            contentToken = UUID().uuidString
            errorMessage = nil
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

    public func archive() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.archive(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.article?.isArchived = result.isArchived
        }
    }

    public func moveToInbox() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.unarchive(articleID: articleID)
            guard self.isCurrentAction(actionGeneration) else {
                return
            }
            self.article?.isArchived = result.isArchived
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
        }
    }

    public func delete() async {
        await performAction { articleID, actionGeneration in
            let result = try await self.client.delete(articleID: articleID)
            if result.deleted, isCurrentAction(actionGeneration) {
                self.isDeleted = true
                self.positionStore.remove(articleID: articleID)
                self.onDeleted?()
            }
        }
    }

    private func applyPublication(
        _ result: ReaderPublicationResult,
        published: Bool
    ) {
        article?.isPublished = result.article?.isPublished ?? published
    }

    private func performAction(
        _ action: (Int, Int) async throws -> Void
    ) async {
        guard let selection, !isPerformingAction else {
            return
        }

        let articleID = selection.articleID
        actionGeneration += 1
        let generation = actionGeneration
        isPerformingAction = true
        actionErrorMessage = nil
        defer {
            isPerformingAction = false
        }

        do {
            try await action(articleID, generation)
        } catch {
            guard isCurrentAction(generation) else {
                return
            }
            actionErrorMessage = Self.message(for: error)
        }
    }

    private func reloadCurrentArticle() async {
        guard let selection else {
            return
        }

        requestGeneration += 1
        await load(selection, requestGeneration: requestGeneration)
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
        case .contentUnavailable:
            "请求的文章不可用"
        case .invalidInput:
            "文章请求无效，请刷新后重试"
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

    public func archive(articleID: Int) async throws -> ReaderArchiveResult {
        try await send(.post("articles/\(articleID)/archive"), authenticated: true)
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

    public func delete(articleID: Int) async throws -> ReaderDeleteResult {
        try await send(.delete("articles/\(articleID)"), authenticated: true)
    }
}
