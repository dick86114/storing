import Foundation
import QiankunjieCore
import QiankunjieNetworking
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

    @Test func 服务端归档响应解码分类() throws {
        let data = Data(
            #"{"isArchived":true,"category":{"id":31,"name":"工程实践"}}"#.utf8
        )

        let result = try JSONDecoder.qiankunjie.decode(
            ReaderArchiveResult.self,
            from: data
        )

        #expect(result.isArchived)
        #expect(result.category?.id == 31)
        #expect(result.category?.name == "工程实践")
    }

    @Test func 阅读器加载桌面版HTML() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)

        await model.open(articleID: 12)

        #expect(await client.lastHTMLVariant == "desktop")
        #expect(model.article?.id == 12)
        #expect(model.errorMessage == nil)
    }

    @Test func 阅读器会刷新生成完成的AI摘要() async {
        let client = 模拟阅读客户端(
            detail: ArticleDetail(id: 12, isArchived: true, aiStatus: "queued")
        )
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)
        await client.updateDetail(
            ArticleDetail(id: 12, aiSummary: "生成完成", isArchived: true, aiStatus: "succeeded")
        )

        await model.refreshAIStatusOnce()

        #expect(model.article?.aiSummary == "生成完成")
        #expect(model.article?.detail.aiStatus == "succeeded")
    }

    @Test func 阅读器AI后台完成会发出目录刷新信号() async {
        let client = 模拟阅读客户端(
            detail: ArticleDetail(id: 12, isArchived: true, aiStatus: "queued")
        )
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)
        var 刷新信号次数 = 0
        model.onCategoryAffectingChange = {
            刷新信号次数 += 1
        }
        await client.updateDetail(ArticleDetail(
            id: 12,
            category: ArticleCategory(id: 31, name: "工程实践"),
            isArchived: true,
            aiStatus: "succeeded"
        ))

        await model.refreshAIStatusOnce()
        await model.refreshAIStatusOnce()

        #expect(刷新信号次数 == 1)
    }

    @Test func 阅读器手动分类归档取消归档删除都会发出目录刷新信号() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)
        var 刷新信号次数 = 0
        model.onCategoryAffectingChange = {
            刷新信号次数 += 1
        }

        await model.archive(categoryID: 31)
        _ = await model.moveToCategory(32)
        await model.moveToInbox()
        await model.delete()
        await model.deletePermanent()

        #expect(刷新信号次数 == 5)
    }

    @Test func 阅读器AI分类完成后重新加载并发出目录刷新信号() async {
        let client = 模拟阅读客户端(
            classificationDetail: ArticleDetail(
                id: 12,
                category: ArticleCategory(id: 31, name: "工程实践"),
                isArchived: true
            )
        )
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)
        var 刷新信号次数 = 0
        var 回调时分类ID: Int?
        model.onCategoryAffectingChange = {
            刷新信号次数 += 1
            回调时分类ID = model.article?.category?.id
        }

        let succeeded = await model.classifyArticle()

        #expect(succeeded)
        #expect(await client.paths.contains("articles/12/classify"))
        #expect(model.article?.category?.id == 31)
        #expect(刷新信号次数 == 1)
        #expect(回调时分类ID == 31)
    }

    @Test func 阅读器旧AI分类在切换文章后完成不会发出目录刷新或覆盖新文章() async {
        let client = 模拟阅读客户端(
            classificationDetail: ArticleDetail(
                id: 12,
                category: ArticleCategory(id: 31, name: "旧文章分类"),
                isArchived: true
            )
        )
        await client.setArticleDetail(
            ArticleDetail(
                id: 13,
                category: ArticleCategory(id: 44, name: "新文章分类"),
                isArchived: true
            ),
            for: 13
        )
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)
        var 刷新信号次数 = 0
        model.onCategoryAffectingChange = {
            刷新信号次数 += 1
        }

        await client.holdNextClassification()
        let 分类任务 = Task { @MainActor in
            await model.classifyArticle()
        }
        await client.waitForClassificationRequestCount(1)
        await model.open(articleID: 13)

        await client.resumeClassification()
        let succeeded = await 分类任务.value

        #expect(!succeeded)
        #expect(model.article?.id == 13)
        #expect(model.article?.category?.id == 44)
        #expect(刷新信号次数 == 0)
    }

    @Test func 阅读器旧AI分类在切换用户后完成不会发出目录刷新或覆盖新文章() async {
        let client = 模拟阅读客户端(
            classificationDetail: ArticleDetail(
                id: 12,
                category: ArticleCategory(id: 31, name: "旧用户文章分类"),
                isArchived: true
            )
        )
        await client.setArticleDetail(
            ArticleDetail(
                id: 14,
                category: ArticleCategory(id: 55, name: "新用户文章分类"),
                isArchived: true
            ),
            for: 14
        )
        let model = ReaderModel(client: client, userID: 1)
        await model.open(articleID: 12)
        var 刷新信号次数 = 0
        model.onCategoryAffectingChange = {
            刷新信号次数 += 1
        }

        await client.holdNextClassification()
        let 分类任务 = Task { @MainActor in
            await model.classifyArticle()
        }
        await client.waitForClassificationRequestCount(1)
        model.prepareUser(userID: 2)
        await model.open(articleID: 14)

        await client.resumeClassification()
        let succeeded = await 分类任务.value

        #expect(!succeeded)
        #expect(model.userID == 2)
        #expect(model.article?.id == 14)
        #expect(model.article?.category?.id == 55)
        #expect(刷新信号次数 == 0)
    }

    @Test func 阅读器归档会携带手工分类并在完成后回调资料库() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)

        await model.archive(categoryID: 31)

        #expect(await client.lastArchiveCategoryID == 31)
        #expect(model.article?.isArchived == true)
    }

    @Test func 阅读器归档成功后立即应用所选分类() async {
        let detail = ArticleDetail(id: 12, aiCategory: "AI 分类")
        let client = 模拟阅读客户端(detail: detail)
        let model = ReaderModel(client: client)
        await model.open(articleID: 12)

        await model.archive(categoryID: 31)

        #expect(model.article?.category?.id == 31)
        #expect(model.article?.category?.name == "工程实践")
    }

    @Test func 阅读器详情暴露封面图() async {
        let client = 模拟阅读客户端(
            detail: 文章详情(id: 41, coverImage: "https://cdn.example.com/cover.jpg")
        )
        let model = ReaderModel(client: client)

        await model.open(articleID: 41)

        #expect(model.article?.coverImage == "https://cdn.example.com/cover.jpg")
    }

    @Test func 游客公开卡片使用公开文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 71,
            publicID: "public-token",
            isGuest: true
        )

        await model.open(selection)

        #expect(await client.paths.first == "publications/public-token")
        #expect(model.articleID == 71)
        #expect(model.errorMessage == nil)
    }

    @Test func 登录私有卡片使用私有文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 72,
            publicID: nil,
            isGuest: false
        )

        await model.open(selection)

        #expect(await client.paths.first == "articles/72?format=html&htmlVariant=desktop")
        #expect(model.articleID == 72)
    }

    @Test func 登录公开卡片优先使用私有文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 73,
            publicID: "public-token",
            isGuest: false
        )

        await model.open(selection)

        #expect(await client.paths.first == "articles/73?format=html&htmlVariant=desktop")
        #expect(model.articleID == 73)
    }

    @Test func 阅读器分类操作只负责移动或归档文章() async throws {
        let current = ArticleCategory(id: 21, name: "待整理")
        let detail = ArticleDetail(id: 12, category: current, isArchived: true)
        let client = 模拟阅读客户端(detail: detail)
        let model = ReaderModel(client: client)

        await model.open(articleID: 12)
        let moved = await model.moveToCategory(31)
        #expect(model.article?.category?.id == 31)
        await model.archive(categoryID: 41)

        #expect(moved)
        #expect(await client.categoryPaths == ["articles/12/category"])
        #expect(await client.lastMovedCategoryID == 31)
        #expect(await client.lastArchiveCategoryID == 41)
        #expect(model.article?.category?.id == 41)
        #expect(model.actionErrorMessage == nil)

        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/QiankunjieReader/ReaderModel.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(!source.contains("availableCategories"))
        #expect(!source.contains("func loadCategories()"))
        #expect(!source.contains("func createCategory(name:"))
    }

    @Test func 阅读器保留分类失效的结构化错误() async {
        let client = 模拟阅读客户端(
            moveError: .categoryUnavailable(message: "分类已停用，不能用于归类")
        )
        let model = ReaderModel(client: client)

        await model.open(articleID: 12)
        let moved = await model.moveToCategory(31)

        #expect(!moved)
        #expect(model.actionError == .categoryUnavailable(message: "分类已停用，不能用于归类"))
        #expect(model.actionErrorMessage == "分类已停用，不能用于归类")
    }

    @Test func API客户端游客公开路由不带认证头() async throws {
        let session = 模拟网络会话(
            data: Data(
                #"{"article":{"id":81,"publicId":"public-token","title":"公开文章","isPublished":true}}"#
                    .utf8
            )
        )
        let client = APIClient(
            baseURL: URL(string: "https://storing.example/api/v1")!,
            session: session
        )
        let selection = ReaderSelection(
            articleID: 81,
            publicID: "public-token",
            isGuest: true
        )

        let detail = try await client.articleDetail(selection)
        let request = try #require(await session.requests.first)

        #expect(detail.id == 81)
        #expect(request.url?.path.hasSuffix("/publications/public-token") == true)
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test func 旧收藏响应不会更新切换后的文章() async throws {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 91)
        await client.holdFavorite()

        let favoriteTask = Task {
            await model.toggleFavorite()
        }
        await client.waitForRequestCount(1)
        await model.open(articleID: 92)
        await client.resumeFavorite()
        await favoriteTask.value

        #expect(model.articleID == 92)
        #expect(model.article?.id == 92)
        #expect(model.article?.isFavorited == false)
        #expect(model.actionErrorMessage == nil)
    }

    @Test func 用户切换后旧动作不会清掉新动作忙碌锁() async throws {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client, userID: 1)
        await model.open(articleID: 91)
        await client.holdFavorite()

        let 旧用户动作 = Task {
            await model.toggleFavorite()
        }
        await client.waitForRequestCount(2)

        model.prepareUser(userID: 2)
        await model.open(articleID: 92)
        await client.holdNextMove()
        let 新用户动作 = Task {
            await model.moveToCategory(31)
        }
        await client.waitForMoveRequestCount(1)

        await client.resumeFavorite()
        await 旧用户动作.value

        #expect(model.isPerformingAction)

        await client.resumeMove()
        _ = await 新用户动作.value

        #expect(!model.isPerformingAction)
        #expect(model.article?.category?.id == 31)
    }

    @Test func 旧删除响应不会关闭切换后的文章() async throws {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 93)
        var deleteCallbackCount = 0
        model.onDeleted = {
            deleteCallbackCount += 1
        }
        await client.holdDelete()

        let deleteTask = Task {
            await model.delete()
        }
        await client.waitForRequestCount(2)
        await model.open(articleID: 94)
        await client.resumeDelete()
        await deleteTask.value

        #expect(model.articleID == 94)
        #expect(model.article?.id == 94)
        #expect(!model.isDeleted)
        #expect(deleteCallbackCount == 0)
    }

    @Test func 过期阅读状态令牌不会写入存储() async throws {
        let store = 内存阅读位置存储()
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client, positionStore: store)
        await model.open(articleID: 95)
        let state = Data("新状态".utf8)

        model.updateReadingState(state, contentToken: "old-token")

        let nextModel = ReaderModel(client: client, positionStore: store)
        await nextModel.open(articleID: 95)
        #expect(nextModel.savedReadingState == nil)
    }

    @Test func 游客账户动作禁用但安全原文链接可用() {
        let guest = ReaderActionPolicy.availability(
            articleID: 96,
            isGuest: true,
            isPerformingAction: false,
            originalURLText: "  https://example.com/article  "
        )

        #expect(!guest.allowsAccountActions)
        #expect(guest.originalURL?.absoluteString == "https://example.com/article")

        let unsafeGuestURL = ReaderActionPolicy.availability(
            articleID: 96,
            isGuest: true,
            isPerformingAction: false,
            originalURLText: "file:///etc/passwd"
        )
        let performingGuestURL = ReaderActionPolicy.availability(
            articleID: 96,
            isGuest: true,
            isPerformingAction: true,
            originalURLText: "https://example.com/article"
        )
        let importedWeChatURL = ReaderActionPolicy.availability(
            articleID: 96,
            isGuest: true,
            isPerformingAction: false,
            originalURLText: "qiankunjie://wechat-import/8B0E6A5E"
        )

        #expect(unsafeGuestURL.originalURL == nil)
        #expect(performingGuestURL.originalURL == nil)
        #expect(importedWeChatURL.originalURL == nil)
    }

    @Test func 登录用户在文章就绪时启用账户动作() {
        let authenticated = ReaderActionPolicy.availability(
            articleID: 97,
            isGuest: false,
            isPerformingAction: false,
            originalURLText: nil
        )

        #expect(authenticated.allowsAccountActions)
        #expect(authenticated.originalURL == nil)
    }

    @Test func 缺少服务端HTML时用文章信息生成中文回退正文() async {
        let client = 模拟阅读客户端(
            detail: 文章详情(
                id: 21,
                title: "快速入门",
                source: "乾坤戒",
                coverImage: "https://cdn.example.com/cover.jpg",
                contentMarkdown: "第一段正文\n\n第二段 <正文>",
                aiSummary: "这是摘要"
            )
        )
        let model = ReaderModel(client: client)

        await model.open(articleID: 21)

        let html = model.displayHTML
        #expect(html.contains("<title>快速入门</title>"))
        #expect(html.contains(#"class="storing-cover""#))
        #expect(html.contains(#"src="https://cdn.example.com/cover.jpg""#))
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
    private var detail: ArticleDetail
    private var articleDetailsByID: [Int: ArticleDetail] = [:]
    private(set) var paths: [String] = []
    private(set) var categoryPaths: [String] = []
    private(set) var lastMovedCategoryID: Int?
    private(set) var lastArchiveCategoryID: Int?
    private let moveError: AppError?
    private(set) var lastHTMLVariant: String?
    private(set) var desktopRequestCount = 0
    private var shouldHoldFavorite = false
    private var shouldHoldDelete = false
    private var favoriteContinuation: CheckedContinuation<ReaderFavoriteResult, Error>?
    private var deleteContinuation: CheckedContinuation<ReaderDeleteResult, Error>?
    private var shouldHoldNextMove = false
    private var moveContinuations: [CheckedContinuation<Void, Error>] = []
    private var moveRequestCount = 0
    private var moveRequestWaiters: [Int: [CheckedContinuation<Void, Never>]] = [:]
    private var requestWaiters: [Int: [CheckedContinuation<Void, Never>]] = [:]
    private var classificationDetail: ArticleDetail?
    private var shouldHoldNextClassification = false
    private var classificationContinuation: CheckedContinuation<ReaderAIResult, Error>?
    private var classificationRequestCount = 0
    private var classificationRequestWaiters: [Int: [CheckedContinuation<Void, Never>]] = [:]

    init(
        detail: ArticleDetail = 文章详情(id: 12),
        moveError: AppError? = nil,
        classificationDetail: ArticleDetail? = nil
    ) {
        self.detail = detail
        self.moveError = moveError
        self.classificationDetail = classificationDetail
    }

    func articleDetail(articleID: Int, htmlVariant: String) async throws -> ArticleDetail {
        paths.append("articles/\(articleID)?format=html&htmlVariant=\(htmlVariant)")
        notifyRequestWaiters()
        lastHTMLVariant = htmlVariant
        if htmlVariant == "desktop" {
            desktopRequestCount += 1
        }
        if let detail = articleDetailsByID[articleID] {
            return detail
        }
        return articleID == detail.id ? detail : 文章详情(id: articleID)
    }

    func articleDetail(_ selection: ReaderSelection) async throws -> ArticleDetail {
        if selection.isGuest, let publicID = selection.publicID {
            paths.append("publications/\(publicID)")
            notifyRequestWaiters()
            return 文章详情(id: selection.articleID)
        }

        return try await articleDetail(
            articleID: selection.articleID,
            htmlVariant: "desktop"
        )
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        paths.append("articles/\(articleID)/favorite")
        notifyRequestWaiters()
        if shouldHoldFavorite {
            shouldHoldFavorite = false
            return try await withCheckedThrowingContinuation { continuation in
                favoriteContinuation = continuation
            }
        }
        return ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int, categoryID: Int?) async throws -> ReaderArchiveResult {
        paths.append("articles/\(articleID)/archive")
        lastArchiveCategoryID = categoryID
        let category = categoryID.map {
            ArticleCategory(id: $0, name: "工程实践")
        }
        return ReaderArchiveResult(isArchived: true, category: category)
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

    func classifyArticle(articleID: Int) async throws -> ReaderAIResult {
        classificationRequestCount += 1
        notifyClassificationRequestWaiters()
        paths.append("articles/\(articleID)/classify")
        if shouldHoldNextClassification {
            shouldHoldNextClassification = false
            let result = try await withCheckedThrowingContinuation { continuation in
                classificationContinuation = continuation
            }
            if let classificationDetail {
                detail = classificationDetail
            }
            return result
        }
        if let classificationDetail {
            detail = classificationDetail
        }
        return ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        paths.append("articles/\(articleID)")
        notifyRequestWaiters()
        if shouldHoldDelete {
            shouldHoldDelete = false
            return try await withCheckedThrowingContinuation { continuation in
                deleteContinuation = continuation
            }
        }
        return ReaderDeleteResult(deleted: true)
    }

    func renameArticle(articleID: Int, title: String) async throws {
        paths.append("articles/\(articleID)/title")
        notifyRequestWaiters()
    }

    func moveArticleToCategory(articleID: Int, categoryID: Int) async throws {
        moveRequestCount += 1
        notifyMoveRequestWaiters()
        if let moveError {
            throw moveError
        }
        if shouldHoldNextMove {
            shouldHoldNextMove = false
            try await withCheckedThrowingContinuation { continuation in
                moveContinuations.append(continuation)
            }
        }
        categoryPaths.append("articles/\(articleID)/category")
        lastMovedCategoryID = categoryID
        detail = ArticleDetail(
            id: articleID,
            category: ArticleCategory(id: categoryID, name: "已移动"),
            isArchived: true
        )
        notifyRequestWaiters()
    }

    func permanentDelete(articleID: Int) async throws {
        paths.append("articles/\(articleID)/permanent")
        notifyRequestWaiters()
    }

    func updateDetail(_ detail: ArticleDetail) {
        self.detail = detail
    }

    func setArticleDetail(_ detail: ArticleDetail, for articleID: Int) {
        articleDetailsByID[articleID] = detail
    }

    func holdFavorite() {
        shouldHoldFavorite = true
    }

    func resumeFavorite() {
        favoriteContinuation?.resume(returning: ReaderFavoriteResult(isFavorited: true))
        favoriteContinuation = nil
    }

    func holdDelete() {
        shouldHoldDelete = true
    }

    func holdNextMove() {
        shouldHoldNextMove = true
    }

    func holdNextClassification() {
        shouldHoldNextClassification = true
    }

    func waitForClassificationRequestCount(_ count: Int) async {
        guard classificationRequestCount < count else { return }
        await withCheckedContinuation { continuation in
            classificationRequestWaiters[count, default: []].append(continuation)
        }
    }

    func resumeClassification() {
        classificationContinuation?.resume(returning: ReaderAIResult(ok: true))
        classificationContinuation = nil
    }

    func waitForMoveRequestCount(_ count: Int) async {
        guard moveRequestCount < count else { return }
        await withCheckedContinuation { continuation in
            moveRequestWaiters[count, default: []].append(continuation)
        }
    }

    func resumeMove(with result: Result<Void, Error> = .success(())) {
        guard !moveContinuations.isEmpty else { return }
        let continuation = moveContinuations.removeFirst()
        continuation.resume(with: result)
    }

    func resumeDelete() {
        deleteContinuation?.resume(returning: ReaderDeleteResult(deleted: true))
        deleteContinuation = nil
    }

    func waitForRequestCount(_ count: Int) async {
        guard paths.count < count else {
            return
        }

        await withCheckedContinuation { continuation in
            requestWaiters[count, default: []].append(continuation)
        }
    }

    private func notifyRequestWaiters() {
        let readyKeys = requestWaiters.keys.filter { $0 <= paths.count }
        for key in readyKeys {
            let waiters = requestWaiters.removeValue(forKey: key) ?? []
            waiters.forEach { $0.resume() }
        }
    }

    private func notifyMoveRequestWaiters() {
        let readyKeys = moveRequestWaiters.keys.filter { $0 <= moveRequestCount }
        for key in readyKeys {
            let waiters = moveRequestWaiters.removeValue(forKey: key) ?? []
            waiters.forEach { $0.resume() }
        }
    }

    private func notifyClassificationRequestWaiters() {
        let readyKeys = classificationRequestWaiters.keys.filter { $0 <= classificationRequestCount }
        for key in readyKeys {
            let waiters = classificationRequestWaiters.removeValue(forKey: key) ?? []
            waiters.forEach { $0.resume() }
        }
    }
}

private final class 内存阅读位置存储: ReaderPositionStoring, @unchecked Sendable {
    private var states: [Int: Data] = [:]
    private var currentUserID: Int?
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

    func prepareUser(userID: Int?) {
        guard currentUserID != userID else { return }

        lock.withLock {
            currentUserID = userID
            states.removeAll()
        }
    }
}

private actor 模拟网络会话: URLSessioning {
    private let data: Data
    private(set) var requests: [URLRequest] = []

    init(data: Data) {
        self.data = data
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (data, response)
    }
}

private func 文章详情(
    id: Int,
    title: String? = nil,
    source: String? = nil,
    coverImage: String? = nil,
    contentMarkdown: String? = nil,
    aiSummary: String? = nil,
    isArchived: Bool = false,
    aiStatus: String? = nil
) -> ArticleDetail {
    ArticleDetail(
        id: id,
        title: title,
        source: source,
        coverImage: coverImage,
        aiSummary: aiSummary,
        isArchived: isArchived,
        contentMarkdown: contentMarkdown,
        aiStatus: aiStatus
    )
}
