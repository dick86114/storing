import Foundation
import QiankunjieCore
import SwiftUI
import Testing
@testable import QiankunjieMac

struct CompactArticleListLayoutTests {
    @Test func 左右布局封面方形并保留卡片内边距() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.rowHeight == 132)
        #expect(metrics.rowCoverSize == 104)
    }

    @Test func 左右布局封面使用一比一比例() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.rowCoverAspectRatio == 1)
        #expect(metrics.rowCoverSize == 104)
    }

    @Test func 卡片封面使用微信头条比例() {
        let metrics = CompactArticleListLayoutMetrics()

        #expect(metrics.cardCoverAspectRatio == 2.35)
        #expect(metrics.cardCoverAspectRatio != metrics.rowCoverAspectRatio)
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

    @Test func 滚动容器清除系统默认内容边距() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("QiankunjieMac/Features/Library/ThinScrollView.swift"),
            encoding: .utf8
        )

        #expect(source.contains(".contentMargins(.horizontal, 0, for: .scrollContent)"))
        #expect(source.contains("GeometryReader { proxy in"))
        #expect(source.contains(".frame(width: proxy.size.width)"))
    }

    @Test func 细滚动条生成可拖动布局() {
        let geometry = ScrollGeometry(
            contentOffset: CGPoint(x: 0, y: 150),
            contentSize: CGSize(width: 340, height: 1200),
            contentInsets: EdgeInsets(),
            containerSize: CGSize(width: 340, height: 600)
        )

        let model = ThinScrollBarModel(geometry: geometry, trackHeight: 584)

        #expect(model?.thumbHeight == 292)
        #expect(model?.thumbOffset == 81)
        #expect(model?.maximumContentOffset == 600)
        #expect(model?.maximumTravel == 292)
    }

    @Test func 拖动细滚动条按轨道比例滚动内容() throws {
        let geometry = ScrollGeometry(
            contentOffset: CGPoint(x: 0, y: 150),
            contentSize: CGSize(width: 340, height: 1200),
            contentInsets: EdgeInsets(),
            containerSize: CGSize(width: 340, height: 600)
        )
        let model = try #require(ThinScrollBarModel(geometry: geometry, trackHeight: 584))

        let target = model.targetContentOffset(
            startLocationY: 100,
            locationY: 140,
            initialContentOffsetY: 150,
            isThumbDrag: true
        )

        #expect(abs(target - 232.19) < 0.01)
    }

    @Test func 点击轨道把滑块中心移到点击处() throws {
        let geometry = ScrollGeometry(
            contentOffset: CGPoint(x: 0, y: 150),
            contentSize: CGSize(width: 340, height: 1200),
            contentInsets: EdgeInsets(),
            containerSize: CGSize(width: 340, height: 600)
        )
        let model = try #require(ThinScrollBarModel(geometry: geometry, trackHeight: 584))

        let target = model.targetContentOffset(
            startLocationY: 400,
            locationY: 400,
            initialContentOffsetY: 150,
            isThumbDrag: false
        )

        #expect(abs(target - 505.48) < 0.01)
    }

    @Test func 细滚动条不能禁止点击() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("QiankunjieMac/Features/Library/ThinScrollView.swift"),
            encoding: .utf8
        )

        #expect(!source.contains(".allowsHitTesting(false)"))
        #expect(source.contains(".scrollPosition($scrollPosition)"))
        #expect(source.contains("DragGesture(minimumDistance: 0)"))
    }

    @Test func 细滚动条透明度按交互状态分层() {
        #expect(
            ThinScrollBarAppearance.thumbOpacity(
                isDragging: false,
                isHovering: false
            ) == 0.24
        )
        #expect(
            ThinScrollBarAppearance.thumbOpacity(
                isDragging: false,
                isHovering: true
            ) == 0.36
        )
        #expect(
            ThinScrollBarAppearance.thumbOpacity(
                isDragging: true,
                isHovering: true
            ) == 0.48
        )
    }

    @Test func 细滚动条滑块使用实色避免透明度叠加() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("QiankunjieMac/Features/Library/ThinScrollView.swift"),
            encoding: .utf8
        )

        #expect(!source.contains("Color.black.opacity(0.2)"))
        #expect(!source.contains("Color.white.opacity(0.24)"))
        #expect(source.contains("Color(white: 0.45)"))
        #expect(source.contains(".opacity(scrollBarOpacity)"))
        #expect(source.contains(".overlay(alignment: .topTrailing)"))
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
