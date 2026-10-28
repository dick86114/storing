import Foundation
import Testing
import WebKit
@testable import QiankunjieMac

@MainActor
struct ReaderWebCacheTests {
    @Test func 阅读器使用独立持久化网站缓存() {
        let identifier = UUID()
        let cache = ReaderWebCache(identifier: identifier)
        let configuration = ReaderWebView.makeConfiguration(
            websiteDataStore: cache.websiteDataStore
        )

        #expect(configuration.websiteDataStore.isPersistent)
        #expect(configuration.websiteDataStore.identifier == identifier)
    }

    @Test func 清理网站缓存后可以重新创建同一数据仓库() async throws {
        let identifier = UUID()
        let cache = ReaderWebCache(identifier: identifier)
        _ = cache.websiteDataStore

        await cache.clear()

        #expect(cache.websiteDataStore.identifier == identifier)
    }
}
