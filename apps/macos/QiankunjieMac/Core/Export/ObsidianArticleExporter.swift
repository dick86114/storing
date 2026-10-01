import Foundation

enum ObsidianConflictPolicy: String, Codable, Sendable {
    case appendNumber
    case overwrite

    var title: String {
        switch self {
        case .appendNumber: "自动追加序号"
        case .overwrite: "覆盖同名文件"
        }
    }
}

struct ObsidianExportSettings: Codable, Equatable, Sendable {
    let directoryURL: URL?
    let conflictPolicy: ObsidianConflictPolicy

    static let empty = Self(directoryURL: nil, conflictPolicy: .appendNumber)

    init(
        directoryURL: URL?,
        conflictPolicy: ObsidianConflictPolicy = .appendNumber
    ) {
        self.directoryURL = directoryURL
        self.conflictPolicy = conflictPolicy
    }
}

enum ObsidianExportError: LocalizedError, Equatable {
    case notConfigured
    case directoryUnavailable

    var errorDescription: String? {
        switch self {
        case .notConfigured: "尚未配置 Obsidian 目录"
        case .directoryUnavailable: "Obsidian 目录不可访问，请重新选择"
        }
    }
}

struct ObsidianArticleExporter: Sendable {
    let settings: ObsidianExportSettings

    init(settings: ObsidianExportSettings) {
        self.settings = settings
    }

    func export(_ document: ArticleExportDocument) throws -> URL {
        guard let directoryURL = settings.directoryURL else {
            throw ObsidianExportError.notConfigured
        }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: directoryURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            throw ObsidianExportError.directoryUnavailable
        }

        let markdown = MarkdownArticleRenderer().render(document)
        let baseName = safeExportFileName(document.title)
        let targetURL = resolveTargetURL(
            directoryURL: directoryURL,
            baseName: baseName,
            policy: settings.conflictPolicy
        )
        try markdown.data(using: .utf8)?.write(to: targetURL, options: .atomic)
        return targetURL
    }

    private func resolveTargetURL(
        directoryURL: URL,
        baseName: String,
        policy: ObsidianConflictPolicy
    ) -> URL {
        let directURL = directoryURL.appendingPathComponent("\(baseName).md")
        guard policy == .appendNumber, FileManager.default.fileExists(atPath: directURL.path) else {
            return directURL
        }

        var index = 2
        while true {
            let candidate = directoryURL.appendingPathComponent("\(baseName)-\(index).md")
            if !FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
            index += 1
        }
    }
}

struct ObsidianExportSettingsStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let directoryKey = "export.obsidian.directory"
    private let vaultKey = "export.obsidian.vault"
    private let conflictKey = "export.obsidian.conflictPolicy"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> ObsidianExportSettings {
        let path = defaults.string(forKey: directoryKey)
        let policy = defaults.string(forKey: conflictKey)
            .flatMap(ObsidianConflictPolicy.init(rawValue:)) ?? .appendNumber
        return ObsidianExportSettings(
            directoryURL: path.map { URL(fileURLWithPath: $0, isDirectory: true) },
            conflictPolicy: policy
        )
    }

    func loadVaultURL() -> URL? {
        defaults.string(forKey: vaultKey)
            .map { URL(fileURLWithPath: $0, isDirectory: true) }
    }

    func save(_ settings: ObsidianExportSettings, vaultURL: URL? = nil) {
        defaults.set(settings.directoryURL?.path, forKey: directoryKey)
        if let vaultURL {
            defaults.set(vaultURL.path, forKey: vaultKey)
        }
        defaults.set(settings.conflictPolicy.rawValue, forKey: conflictKey)
    }
}
