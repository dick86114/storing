import Foundation

struct ObsidianVault: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let url: URL
    let isOpen: Bool
}

struct ObsidianVaultRegistry: Sendable {
    let configURL: URL

    init(configURL: URL = Self.defaultConfigURL) {
        self.configURL = configURL
    }

    static var defaultConfigURL: URL {
        let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.homeDirectoryForCurrentUser
        return applicationSupport
            .appendingPathComponent("obsidian", isDirectory: true)
            .appendingPathComponent("obsidian.json")
    }

    func discover() throws -> [ObsidianVault] {
        guard FileManager.default.fileExists(atPath: configURL.path) else {
            return []
        }

        let data = try Data(contentsOf: configURL)
        guard
            let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let vaultDictionary = root["vaults"] as? [String: Any]
        else {
            return []
        }

        var vaults: [ObsidianVault] = []
        for value in vaultDictionary.values {
            guard
                let metadata = value as? [String: Any],
                let path = metadata["path"] as? String
            else {
                continue
            }

            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                continue
            }

            let url = URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
            vaults.append(
                ObsidianVault(
                    id: url.path,
                    name: url.lastPathComponent.isEmpty ? url.path : url.lastPathComponent,
                    url: url,
                    isOpen: metadata["open"] as? Bool ?? false
                )
            )
        }

        return vaults.sorted { lhs, rhs in
            if lhs.isOpen != rhs.isOpen {
                return lhs.isOpen
            }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }
}

struct ObsidianDirectoryItem: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let relativePath: String
    let depth: Int
}

struct ObsidianDirectoryIndex: Sendable {
    let vaultURL: URL
    let allItems: [ObsidianDirectoryItem]

    init(vaultURL: URL) throws {
        let normalizedVaultURL = vaultURL.standardizedFileURL
        var items = [
            ObsidianDirectoryItem(
                id: "",
                name: "根目录",
                relativePath: "",
                depth: 0
            )
        ]
        var queue: [(url: URL, relativePath: String, depth: Int)] = [
            (normalizedVaultURL, "", 0)
        ]
        var index = 0

        while index < queue.count {
            let current = queue[index]
            index += 1

            let contents = try FileManager.default.contentsOfDirectory(
                at: current.url,
                includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
                options: [.skipsHiddenFiles]
            )

            for url in contents.sorted(by: { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }) {
                let name = url.lastPathComponent
                guard !name.hasPrefix(".") else { continue }

                let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
                guard values.isDirectory == true, values.isSymbolicLink != true else {
                    continue
                }

                let relativePath = current.relativePath.isEmpty
                    ? name
                    : "\(current.relativePath)/\(name)"
                items.append(
                    ObsidianDirectoryItem(
                        id: relativePath,
                        name: name,
                        relativePath: relativePath,
                        depth: current.depth + 1
                    )
                )
                queue.append((url, relativePath, current.depth + 1))
            }
        }

        self.vaultURL = normalizedVaultURL
        self.allItems = items
    }

    func items(matching query: String) -> [ObsidianDirectoryItem] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty else {
            return allItems
        }

        return allItems.filter { item in
            item.name.localizedCaseInsensitiveContains(normalizedQuery)
                || item.relativePath.localizedCaseInsensitiveContains(normalizedQuery)
        }
    }
}
