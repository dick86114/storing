import Foundation
import Testing
@testable import QiankunjieCore

@Test func 文章卡片解码服务端蛇形命名字段() throws {
    let data = #"{"id":7,"title":"测试","original_url":"https://example.com","is_favorited":true,"is_archived":false,"is_published":true}"#.data(using: .utf8)!
    let article = try JSONDecoder.qiankunjie.decode(ArticleCard.self, from: data)
    #expect(article.id == 7)
    #expect(article.originalURL == "https://example.com")
    #expect(article.isFavorited)
    #expect(article.isPublished)
}

@Test func 资料库查询缓存标识随每个作用域字段变化() {
    let base = LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "swift", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: "wechat", page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(userId: 7, view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .inbox, searchText: "", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .published, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .asc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: 3, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, page: 2, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, page: 1, perPage: 50).cacheIdentity)
    #expect(LibraryQuery(view: .archive, searchText: " Swift ", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity == LibraryQuery(view: .archive, searchText: "swift", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
}

@Test func 文章列表页和计数解码服务端字段() throws {
    let data = #"""
    {"articles":[{"id":7,"original_url":"https://example.com","ai_tags":[],"is_favorited":true,"is_archived":false,"is_published":true}],"total":4,"page":2,"per_page":20,"total_pages":1}
    """#.data(using: .utf8)!
    let page = try JSONDecoder.qiankunjie.decode(ArticleListPage.self, from: data)
    let counts = try JSONDecoder.qiankunjie.decode(ArticleCounts.self, from: #"{"inbox":1,"favorites":2,"archive":3,"published":4}"#.data(using: .utf8)!)
    #expect(page.articles.map(\.id) == [7])
    #expect(page.page == 2)
    #expect(page.perPage == 20)
    #expect(counts == ArticleCounts(inbox: 1, favorites: 2, archive: 3, published: 4))
}

@Test func 文章详情解码分类正文和蛇形命名字段() throws {
    let data = #"""
    {"id":7,"original_url":"https://example.com","public_id":"p-7","publish_time":"2026-01-01T00:00:00Z","created_at":"2026-01-02T00:00:00Z","ai_summary":"摘要","ai_category":"技术","ai_tags":["Swift"],"category":{"id":3,"name":"技术","is_system":true},"category_result":{"category_id":3,"confidence":0.9,"source":"ai","review_status":"accepted"},"is_favorited":true,"is_archived":false,"is_published":true,"content_html":"<p>正文</p>","content_md":"正文"}
    """#.data(using: .utf8)!
    let detail = try JSONDecoder.qiankunjie.decode(ArticleDetail.self, from: data)
    #expect(detail.publicID == "p-7")
    #expect(detail.category?.id == 3)
    #expect(detail.categoryResult?.categoryId == 3)
    #expect(detail.contentHTML == "<p>正文</p>")
    #expect(detail.contentMarkdown == "正文")
}

@Test func 文章详情解码服务端驼峰字段和毫秒时间() throws {
    let data = #"""
    {
      "id": 354,
      "publicId": "4f113bf2-7807-4ccf-8bb5-3bffc269a7cd",
      "publishTime": "2026-09-28T13:16:02.000Z",
      "publishedAt": "2026-09-29T02:50:52.171Z",
      "isPublished": true,
      "contentHtml": "<p>正文</p>",
      "contentMd": "正文"
    }
    """#.data(using: .utf8)!

    let detail = try JSONDecoder.qiankunjie.decode(ArticleDetail.self, from: data)

    #expect(detail.publicID == "4f113bf2-7807-4ccf-8bb5-3bffc269a7cd")
    #expect(detail.publishTime != nil)
    #expect(detail.contentHTML == "<p>正文</p>")
}

@Test func 采集任务解码队列字段和终态() throws {
    let data = #"""
    {"id":11,"url":"https://example.com/a","normalized_url":"https://example.com/a","status":"completed","stage":"completed","method":"singlefile","capture_strategy":"desktop","article_id":7,"title":"文章","error":null,"error_summary":null,"error_details":[],"error_hint":null,"created_at":"2026-09-29T00:00:00Z","updated_at":"2026-09-29T00:00:00Z","started_at":"2026-09-29T00:00:00Z","finished_at":"2026-09-29T00:00:00Z"}
    """#.data(using: .utf8)!
    let job = try JSONDecoder.qiankunjie.decode(CollectJob.self, from: data)
    #expect(job.articleId == 7)
    #expect(job.captureStrategy == "desktop")
    #expect(job.isTerminal)
}

@Test func 应用错误是可传递可比较的无参数错误类别() {
    let sendableError: AppError = .server
    #expect(sendableError == AppError.server)
    #expect(sendableError != AppError.authenticationRequired)
    #expect(AppError.network == AppError.network)
    #expect(AppError.forbidden == AppError.forbidden)
    #expect(AppError.contentUnavailable == AppError.contentUnavailable)
    #expect(AppError.invalidInput == AppError.invalidInput)
}
