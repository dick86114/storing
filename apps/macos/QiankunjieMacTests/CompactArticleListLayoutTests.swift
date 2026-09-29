import Testing
@testable import QiankunjieMac

struct CompactArticleListLayoutTests {
    @Test func 窄中央列的长内容使用固定行高和受限文本宽度() {
        let metrics = CompactArticleListLayoutMetrics(centerWidth: 280)

        #expect(metrics.rowHeight == 132)
        #expect(metrics.coverSize == 56)
        #expect(metrics.maximumTextWidth == 170)
        #expect(metrics.maximumTagWidth < metrics.maximumTextWidth)
    }

    @Test func 长标签会被截断且标签数量不超过三个() {
        let metrics = CompactArticleListLayoutMetrics(centerWidth: 280)
        let longTag = String(repeating: "长", count: 80)

        let displayedTags = metrics.displayTags([
            longTag,
            "Swift",
            "离线",
            "第四个不应出现",
        ])

        #expect(displayedTags.count == 3)
        #expect(displayedTags.first?.count == metrics.maximumTagCharacters)
        #expect(displayedTags.last == "离线")
    }

    @Test func 相同截断前缀的不同标签保持独立身份() {
        let metrics = CompactArticleListLayoutMetrics(centerWidth: 280)
        let firstTag = String(repeating: "长", count: 80) + "一"
        let secondTag = String(repeating: "长", count: 80) + "二"

        let visibleTags = metrics.visibleTags([
            firstTag,
            secondTag,
            "离线",
        ])

        #expect(visibleTags.map(\.id) == [firstTag, secondTag, "离线"])
        #expect(visibleTags.map(\.text).count == 3)
        #expect(visibleTags[0].text == visibleTags[1].text)
        #expect(visibleTags[0].text.count == metrics.maximumTagCharacters)
    }
}
