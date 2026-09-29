import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieReader

@MainActor
@Suite("阅读器模型")
struct ReaderModelTests {
    @Test func 服务端重抓响应解码内容HTML标志() throws {
        let data = Data(#"{"contentHtml":true}"#.utf8)

        let result = try JSONDecoder.qiankunjie.decode(
            ReaderRefetchResult.self,
            from: data
        )

        #expect(result.hasHTML)
    }

    @Test func 服务端发布响应解码文章和公开链接() throws {
        let data = Data(#"{"article":{"id":81,"isPublished":true},"publicUrl":"/p/token"}"#.utf8)

        let result = try JSONDecoder.qiankunjie.decode(
            ReaderPublicationResult.self,
            from: data
        )

        #expect(result.article?.id == 81)
        #expect(result.article?.isPublished == true)
        #expect(result.publicURL == "/p/token")
    }

    @Test func 阅读器加载桌面版HTML() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)

        await model.open(articleID: 12)

        #expect(await client.lastHTMLVariant == "desktop")
        #expect(model.article?.id == 12)
        #expect(model.errorMessage == nil)
    }

    @Test func 缺少服务端HTML时用文章信息生成中文回退正文() async {
        let client = 模拟阅读客户端(
            detail: 文章详情(
                id: 21,
                title: "快速入门",
                source: "乾坤戒",
                contentMarkdown: "第一段正文\n\n第二段 <正文>",
                aiSummary: "这是摘要"
            )
        )
        let model = ReaderModel(client: client)

        await model.open(articleID: 21)

        let html = model.displayHTML
        #expect(html.contains("<title>快速入门</title>"))
        #expect(html.contains("来源：乾坤戒"))
        #expect(html.contains("这是摘要"))
        #expect(html.contains("<p>第一段正文</p>"))
        #expect(html.contains("第二段 &lt;正文&gt;"))
    }

    @Test func 文章动作调用对应服务端路径并更新状态() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 31)

        await model.toggleFavorite()
        await model.archive()
        await model.moveToInbox()
        await model.publish()
        await model.unpublish()

        #expect(await client.paths == [
            "articles/31?format=html&htmlVariant=desktop",
            "articles/31/favorite",
            "articles/31/archive",
            "articles/31/unarchive",
            "articles/31/publish",
            "articles/31/unpublish",
        ])
        #expect(model.article?.isFavorited == true)
        #expect(model.article?.isArchived == false)
        #expect(model.article?.isPublished == false)
    }

    @Test func 重抓和重新生成AI完成后重新加载详情() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 42)

        await model.refetch()
        await model.regenerateAI()

        #expect(await client.paths.contains("articles/42/refetch"))
        #expect(await client.paths.contains("articles/42/regenerate-ai"))
        #expect(await client.desktopRequestCount == 3)
        #expect(model.articleID == 42)
    }

    @Test func 删除会记录结果并通知界面关闭阅读器() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 53)
        var deleteCallbackCount = 0
        model.onDeleted = {
            deleteCallbackCount += 1
        }

        await model.delete()

        #expect(await client.paths.last == "articles/53")
        #expect(model.isDeleted)
        #expect(deleteCallbackCount == 1)
    }

    @Test func 阅读位置按文章保存和恢复() async throws {
        let store = 内存阅读位置存储()
        let client = 模拟阅读客户端()
        let firstModel = ReaderModel(client: client, positionStore: store)
        await firstModel.open(articleID: 64)
        let readingState = Data("阅读位置-64".utf8)

        firstModel.updateReadingState(readingState)

        let secondModel = ReaderModel(client: client, positionStore: store)
        await secondModel.open(articleID: 64)
        #expect(secondModel.savedReadingState == readingState)

        await secondModel.open(articleID: 65)
        #expect(secondModel.savedReadingState == nil)
    }
}

private actor 模拟阅读客户端: ReaderNetworkClient {
    private let detail: ArticleDetail
    private(set) var paths: [String] = []
    private(set) var lastHTMLVariant: String?
    private(set) var desktopRequestCount = 0

    init(detail: ArticleDetail = 文章详情(id: 12)) {
        self.detail = detail
    }

    func articleDetail(articleID: Int, htmlVariant: String) async throws -> ArticleDetail {
        paths.append("articles/\(articleID)?format=html&htmlVariant=\(htmlVariant)")
        lastHTMLVariant = htmlVariant
        if htmlVariant == "desktop" {
            desktopRequestCount += 1
        }
        return detail
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        paths.append("articles/\(articleID)/favorite")
        return ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int) async throws -> ReaderArchiveResult {
        paths.append("articles/\(articleID)/archive")
        return ReaderArchiveResult(isArchived: true)
    }

    func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        paths.append("articles/\(articleID)/unarchive")
        return ReaderArchiveResult(isArchived: false)
    }

    func publish(articleID: Int) async throws -> ReaderPublicationResult {
        paths.append("articles/\(articleID)/publish")
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        paths.append("articles/\(articleID)/unpublish")
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        paths.append("articles/\(articleID)/refetch")
        return ReaderRefetchResult(hasHTML: true)
    }

    func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        paths.append("articles/\(articleID)/regenerate-ai")
        return ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        paths.append("articles/\(articleID)")
        return ReaderDeleteResult(deleted: true)
    }
}

private final class 内存阅读位置存储: ReaderPositionStoring, @unchecked Sendable {
    private var states: [Int: Data] = [:]
    private let lock = NSLock()

    func readingState(articleID: Int) -> Data? {
        lock.withLock {
            states[articleID]
        }
    }

    func save(_ state: Data, articleID: Int) {
        lock.withLock {
            states[articleID] = state
        }
    }

    func remove(articleID: Int) {
        lock.withLock {
            _ = states.removeValue(forKey: articleID)
        }
    }
}

private func 文章详情(
    id: Int,
    title: String? = nil,
    source: String? = nil,
    contentMarkdown: String? = nil,
    aiSummary: String? = nil
) -> ArticleDetail {
    ArticleDetail(
        id: id,
        title: title,
        source: source,
        aiSummary: aiSummary,
        contentMarkdown: contentMarkdown
    )
}
