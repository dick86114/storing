import Foundation

/// 按保管库保存用户固定的 Obsidian 常用目录，目录使用仓库内相对路径。
struct ObsidianFavoriteDirectoriesStore: @unchecked Sendable {
    static let maximumCount = 6

    private let defaults: UserDefaults
    private let storageKey = "export.obsidian.favoriteDirectories"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(forVaultURL vaultURL: URL) -> [String] {
        normalizedPaths(loadMapping()[vaultKey(for: vaultURL)] ?? [])
    }

    func save(_ relativePaths: [String], forVaultURL vaultURL: URL) {
        var mapping = loadMapping()
        let key = vaultKey(for: vaultURL)
        let paths = normalizedPaths(relativePaths)

        if paths.isEmpty {
            mapping.removeValue(forKey: key)
        } else {
            mapping[key] = paths
        }
        persist(mapping)
    }

    @discardableResult
    func toggle(_ relativePath: String, forVaultURL vaultURL: URL) -> [String] {
        let path = normalizedPath(relativePath)
        var paths = load(forVaultURL: vaultURL)

        if let index = paths.firstIndex(of: path) {
            paths.remove(at: index)
        } else if paths.count < Self.maximumCount {
            paths.append(path)
        }

        save(paths, forVaultURL: vaultURL)
        return paths
    }

    @discardableResult
    func move(_ relativePath: String, before targetPath: String, forVaultURL vaultURL: URL) -> [String] {
        let source = normalizedPath(relativePath)
        let target = normalizedPath(targetPath)
        var paths = load(forVaultURL: vaultURL)

        guard
            source != target,
            let sourceIndex = paths.firstIndex(of: source),
            paths.contains(target)
        else {
            return paths
        }

        let item = paths.remove(at: sourceIndex)
        if let targetIndex = paths.firstIndex(of: target) {
            paths.insert(item, at: targetIndex)
        } else {
            paths.append(item)
        }
        save(paths, forVaultURL: vaultURL)
        return paths
    }

    private func vaultKey(for vaultURL: URL) -> String {
        vaultURL.standardizedFileURL.path
    }

    private func loadMapping() -> [String: [String]] {
        guard
            let data = defaults.data(forKey: storageKey),
            let mapping = try? JSONDecoder().decode([String: [String]].self, from: data)
        else {
            return [:]
        }
        return mapping
    }

    private func persist(_ mapping: [String: [String]]) {
        guard let data = try? JSONEncoder().encode(mapping) else { return }
        defaults.set(data, forKey: storageKey)
    }

    private func normalizedPaths(_ paths: [String]) -> [String] {
        var seen = Set<String>()
        return paths
            .map(normalizedPath)
            .filter { seen.insert($0).inserted }
            .prefix(Self.maximumCount)
            .map { $0 }
    }

    private func normalizedPath(_ path: String) -> String {
        path
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: "/", omittingEmptySubsequences: true)
            .joined(separator: "/")
    }
}
