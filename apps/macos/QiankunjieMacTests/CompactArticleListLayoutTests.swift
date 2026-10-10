import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct CompactArticleListLayoutTests {
    @Test func 列表封面方形并保留卡片内边距() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.rowHeight == 132)
        #expect(metrics.coverSize == 104)
    }

    @Test func 列表封面使用一比一比例() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.coverAspectRatio == 1)
        #expect(metrics.coverWidth == 104)
    }

    @Test func 文章列表右侧保留紧凑边距() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("QiankunjieMac/Features/Library/CompactArticleListView.swift"),
            encoding: .utf8
        )

        #expect(source.contains(".padding(.trailing, 8)"))
        #expect(!source.contains(".padding(.trailing, 4)"))
    }

    @Test func 标签完整展示且不截断() {
        let metrics = CompactArticleListLayoutMetrics()
        let longTag = String(repeating: "长", count: 80)

        let visibleTags = metrics.visibleTags([
            longTag,
            "Swift",
            "离线",
            "第四个也完整展示",
        ])

        #expect(visibleTags.count == 4)
        #expect(visibleTags.first?.text == longTag)
        #expect(visibleTags.last?.text == "第四个也完整展示")
    }

    @Test func 相同截断前缀的不同标签保持独立身份() {
        let metrics = CompactArticleListLayoutMetrics()
        let firstTag = String(repeating: "长", count: 80) + "一"
        let secondTag = String(repeating: "长", count: 80) + "二"

        let visibleTags = metrics.visibleTags([
            firstTag,
            secondTag,
            "离线",
        ])

        #expect(visibleTags.map(\.id) == [firstTag, secondTag, "离线"])
        #expect(visibleTags.map(\.text) == [firstTag, secondTag, "离线"])
    }

    @Test func 微信转发与公众号文章都使用微信来源图标() {
        #expect(CompactArticleListView.sourceSystemImage("微信") == "person.2")
        #expect(CompactArticleListView.sourceSystemImage("微信公众号") == "person.2")
    }

    @Test func 非微信来源继续使用通用文档图标() {
        #expect(CompactArticleListView.sourceSystemImage("少数派") == "doc.text")
        #expect(CompactArticleListView.sourceSystemImage(nil) == "doc.text")
    }

    @Test func 搜索结果展示文章所属栏目() {
        let article = ArticleCard(
            id: 1,
            publicID: "public-1",
            isFavorited: true,
            isArchived: true,
            isPublished: true
        )

        #expect(article.searchSectionNames == "已发布 · 归档 · 收藏")

        let inboxArticle = ArticleCard(id: 2, publicID: "public-2", isPublished: true)
        #expect(inboxArticle.searchSectionNames == "已发布 · 收件箱")

        let pureInboxArticle = ArticleCard(id: 3)
        #expect(pureInboxArticle.searchSectionNames == "收件箱")
    }
}
