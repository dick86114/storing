import Foundation
import Testing
import QiankunjieCore
@testable import QiankunjieReader

@Suite("阅读位置用户隔离")
struct ReaderPositionStoreTests {
    @Test func 用户位置不会跨账号读取() {
        let suiteName = "reader-position-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ReaderPositionStore(defaults: defaults, userID: 7)
        store.save(Data("user-7".utf8), articleID: 12)

        store.prepareUser(userID: 8)

        #expect(store.readingState(articleID: 12) == nil)
        #expect(defaults.dictionaryRepresentation().keys.contains { $0.contains("user.7.article.12") } == false)
    }

    @Test func 旧的全局位置键不会被新用户读取() {
        let suiteName = "reader-position-legacy-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let legacyKey = "qiankunjie.reader.readingPosition.12"
        defaults.set(Data("legacy".utf8), forKey: legacyKey)

        let store = ReaderPositionStore(defaults: defaults, userID: 7)

        #expect(store.readingState(articleID: 12) == nil)
        #expect(defaults.data(forKey: legacyKey) == nil)
    }

    @Test func 初始化只移除旧全局键并保留用户域位置() {
        let suiteName = "reader-position-migration-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let legacyKey = "qiankunjie.reader.readingPosition.12"
        let scopedKey = "qiankunjie.reader.readingPosition.user.7.article.12"
        let scopedState = Data("保留的用户位置".utf8)
        defaults.set(Data("旧全局位置".utf8), forKey: legacyKey)
        defaults.set(scopedState, forKey: scopedKey)

        _ = ReaderPositionStore(defaults: defaults, userID: 7)

        #expect(defaults.data(forKey: legacyKey) == nil)
        #expect(defaults.data(forKey: scopedKey) == scopedState)
    }
}
