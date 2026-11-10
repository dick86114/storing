import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieReader

struct ReaderArticleCacheTests {
    @Test func 文章详情缓存可跨实例读取并统计() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let selection = ReaderSelection(
            articleID: 41,
            publicID: nil,
            isGuest: false,
            expectedCreatedAt: Date(timeIntervalSince1970: 1_794_139_000)
        )
        let detail = ArticleDetail(
            id: 41,
            title: "缓存文章",
            createdAt: Date(timeIntervalSince1970: 1_794_139_000),
            contentHTML: "<article>本地正文</article>",
            updatedAt: Date(timeIntervalSince1970: 1_794_140_100)
        )

        let writer = ReaderArticleCache(directoryURL: directory)
        try await writer.save(detail, selection: selection, userID: 7)

        let reader = ReaderArticleCache(directoryURL: directory)
        let cached = try await reader.load(selection: selection, userID: 7)
        let statistics = try await reader.statistics()

        #expect(cached == detail)
        #expect(statistics.articleCount == 1)
        #expect(statistics.totalBytes > 0)
    }

    @Test func 不同用户与游客的缓存相互隔离() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let privateSelection = ReaderSelection(
            articleID: 42,
            publicID: nil,
            isGuest: false
        )
        let publicSelection = ReaderSelection(
            articleID: 42,
            publicID: "public-42",
            isGuest: true
        )

        try await cache.save(
            ArticleDetail(id: 42, title: "用户一", updatedAt: Date(timeIntervalSince1970: 1_794_140_100)),
            selection: privateSelection,
            userID: 1
        )
        try await cache.save(
            ArticleDetail(id: 42, title: "用户二", updatedAt: Date(timeIntervalSince1970: 1_794_140_100)),
            selection: privateSelection,
            userID: 2
        )
        try await cache.save(
            ArticleDetail(id: 42, title: "游客文章", updatedAt: Date(timeIntervalSince1970: 1_794_140_100)),
            selection: publicSelection,
            userID: nil
        )

        #expect(
            try await cache.load(
                selection: privateSelection,
                userID: 1
            )?.title == "用户一"
        )
        #expect(
            try await cache.load(
                selection: privateSelection,
                userID: 2
            )?.title == "用户二"
        )
        #expect(
            try await cache.load(
                selection: publicSelection,
                userID: nil
            )?.title == "游客文章"
        )
    }

    @Test func 清理缓存会删除全部正文文件() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let selection = ReaderSelection(
            articleID: 43,
            publicID: nil,
            isGuest: false
        )
        try await cache.save(
            ArticleDetail(id: 43, contentHTML: "<p>待清理</p>", updatedAt: Date(timeIntervalSince1970: 1_794_140_100)),
            selection: selection,
            userID: 3
        )

        try await cache.clear()

        #expect(try await cache.load(selection: selection, userID: 3) == nil)
        #expect(try await cache.statistics() == .empty)
    }

    @Test func 超过容量上限时自动淘汰缓存() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(
            directoryURL: directory,
            maximumDiskSize: 32
        )
        let selection = ReaderSelection(
            articleID: 44,
            publicID: nil,
            isGuest: false
        )

        try await cache.save(
            ArticleDetail(
                id: 44,
                title: String(repeating: "缓存", count: 100),
                contentHTML: "<p>\(String(repeating: "正文", count: 100))</p>",
                updatedAt: Date(timeIntervalSince1970: 1_794_140_100)
            ),
            selection: selection,
            userID: 3
        )

        #expect(try await cache.load(selection: selection, userID: 3) == nil)
        #expect(try await cache.statistics() == .empty)
    }

    @Test func 过期缓存会在读取时自动清理() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(
            directoryURL: directory,
            maximumAge: 60 * 24 * 60 * 60
        )
        let selection = ReaderSelection(
            articleID: 45,
            publicID: nil,
            isGuest: false
        )
        try await cache.save(
            ArticleDetail(id: 45, title: "过期文章"),
            selection: selection,
            userID: 3
        )
        let fileURL = try #require(
            FileManager.default.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: nil
            ).first
        )
        try FileManager.default.setAttributes(
            [.modificationDate: Date(timeIntervalSinceNow: -(61 * 24 * 60 * 60))],
            ofItemAtPath: fileURL.path
        )

        #expect(try await cache.load(selection: selection, userID: 3) == nil)
        #expect(try await cache.statistics() == .empty)
    }

    @Test func 复用旧文章ID的旧内容缓存会被识别为过期() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let selection = ReaderSelection(
            articleID: 46,
            publicID: nil,
            isGuest: false,
            expectedCreatedAt: Date(timeIntervalSince1970: 1_794_140_100)
        )

        try await cache.save(
            ArticleDetail(
                id: 46,
                title: "没有更新时间的旧缓存",
                createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                contentHTML: "<p>旧正文</p>"
            ),
            selection: selection,
            userID: 3
        )

        #expect(try await cache.load(selection: selection, userID: 3) == nil)
    }

    @Test func 旧文章和非空更新时间不再阻止缓存命中() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let selection = ReaderSelection(
            articleID: 47,
            publicID: nil,
            isGuest: false,
            expectedCreatedAt: createdAt
        )
        let detail = ArticleDetail(
            id: 47,
            title: "较早发布的文章",
            createdAt: createdAt,
            contentHTML: "<p>新正文</p>",
            updatedAt: Date(timeIntervalSince1970: 1_700_000_100)
        )

        try await cache.save(detail, selection: selection, userID: 3)

        #expect(try await cache.load(selection: selection, userID: 3) == detail)
    }

    @Test func 缺少更新时间的文章仍可读取缓存() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let selection = ReaderSelection(
            articleID: 48,
            publicID: nil,
            isGuest: false,
            expectedCreatedAt: createdAt
        )
        let detail = ArticleDetail(
            id: 48,
            title: "无更新时间文章",
            createdAt: createdAt,
            contentHTML: "<p>正文</p>"
        )

        try await cache.save(detail, selection: selection, userID: 3)

        #expect(try await cache.load(selection: selection, userID: 3) == detail)
    }

    @Test func 服务端毫秒精度差异不会误判文章ID复用() async throws {
        let directory = 临时缓存目录()
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ReaderArticleCache(directoryURL: directory)
        let selection = ReaderSelection(
            articleID: 49,
            publicID: nil,
            isGuest: false,
            expectedCreatedAt: Date(timeIntervalSince1970: 1_700_000_000.733)
        )
        let detail = ArticleDetail(
            id: 49,
            title: "毫秒精度不同的缓存",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            contentHTML: "<p>正文</p>"
        )

        try await cache.save(detail, selection: selection, userID: 3)

        #expect(try await cache.load(selection: selection, userID: 3)?.id == 49)
    }

    private func 临时缓存目录() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "ReaderArticleCacheTests-\(UUID().uuidString)",
                isDirectory: true
            )
    }
}
