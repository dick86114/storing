import Foundation
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryRecentStoreTests {
    @Test func 最近分类按用户隔离且最多保留五个() throws {
        let (defaults, suiteName) = try 临时分类偏好存储()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = CategoryRecentStore(defaults: defaults)

        store.save([1, 2, 3, 4, 5, 6], userID: 7)
        store.save([9, 8], userID: 8)

        #expect(store.load(userID: 7) == [1, 2, 3, 4, 5])
        #expect(store.load(userID: 8) == [9, 8])
        #expect(defaults.array(forKey: "category.recents.7") as? [Int] == [1, 2, 3, 4, 5])
    }

    @Test func 无效ID和重复ID会被过滤() throws {
        let (defaults, suiteName) = try 临时分类偏好存储()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = CategoryRecentStore(defaults: defaults)

        defaults.set([0, -1, 7, 7, 3, 5, 3, 9], forKey: "category.recents.12")
        #expect(store.load(userID: 12) == [7, 3, 5, 9])

        store.save([2, 2, -1, 4, 6], userID: 12)
        #expect(store.load(userID: 12) == [2, 4, 6])
    }
}

private func 临时分类偏好存储() throws -> (defaults: UserDefaults, suiteName: String) {
    let suiteName = "com.idickies.storing.macos.category-recents.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        throw 分类存储测试错误.无法创建临时偏好存储
    }
    defaults.removePersistentDomain(forName: suiteName)
    return (defaults, suiteName)
}

private enum 分类存储测试错误: Error {
    case 无法创建临时偏好存储
}
