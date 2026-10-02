import Testing
@testable import QiankunjieMac

struct CompactArticleListLayoutTests {
    @Test func 文章卡片使用稳定封面和最小行高() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.rowHeight == 132)
        #expect(metrics.coverSize == 56)
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
}
