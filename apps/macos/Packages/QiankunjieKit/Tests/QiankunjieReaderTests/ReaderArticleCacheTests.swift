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
            isGuest: false
        )
        let detail = ArticleDetail(
            id: 41,
            title: "缓存文章",
            contentHTML: "<article>本地正文</article>"
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
            ArticleDetail(id: 42, title: "用户一"),
            selection: privateSelection,
            userID: 1
        )
        try await cache.save(
            ArticleDetail(id: 42, title: "用户二"),
            selection: privateSelection,
            userID: 2
        )
        try await cache.save(
            ArticleDetail(id: 42, title: "游客文章"),
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
            ArticleDetail(id: 43, contentHTML: "<p>待清理</p>"),
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
                contentHTML: "<p>\(String(repeating: "正文", count: 100))</p>"
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

    private func 临时缓存目录() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "ReaderArticleCacheTests-\(UUID().uuidString)",
                isDirectory: true
            )
    }
}
