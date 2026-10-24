import Foundation

@MainActor
protocol CategoryRecentStoring: AnyObject {
    func load(userID: Int) -> [Int]
    func save(_ categoryIDs: [Int], userID: Int)
}

@MainActor
final class CategoryRecentStore: CategoryRecentStoring {
    private let defaults: UserDefaults
    private let maximumCount = 5

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(userID: Int) -> [Int] {
        let stored = defaults.object(forKey: key(for: userID)) as? [Int] ?? []
        return normalized(stored)
    }

    func save(_ categoryIDs: [Int], userID: Int) {
        let normalizedIDs = normalized(categoryIDs)
        if normalizedIDs.isEmpty {
            defaults.removeObject(forKey: key(for: userID))
        } else {
            defaults.set(normalizedIDs, forKey: key(for: userID))
        }
    }

    private func key(for userID: Int) -> String {
        "category.recents.\(userID)"
    }

    private func normalized(_ categoryIDs: [Int]) -> [Int] {
        var seen = Set<Int>()
        var result: [Int] = []
        for categoryID in categoryIDs where categoryID > 0 {
            guard seen.insert(categoryID).inserted else { continue }
            result.append(categoryID)
            if result.count == maximumCount { break }
        }
        return result
    }
}
