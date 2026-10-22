import Foundation

/// 更新日志按版本独立缓存，允许旧版本运行期间提前保存待安装版本日志。
struct UpdateLogCache {
    private static let entriesKey = "update.log.cache.entries.v2"
    private static let legacyVersionKey = "update.log.cached.version"
    private static let legacyTextKey = "update.log.cached.text"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func read(currentVersion: String) -> String? {
        let version = currentVersion.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !version.isEmpty else { return nil }

        if let text = entries()[version],
           !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return text
        }

        // 兼容旧版本只保存“当前版本 + 单条日志”的格式。
        guard
            defaults.string(forKey: Self.legacyVersionKey) == version,
            let legacyText = defaults.string(forKey: Self.legacyTextKey)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !legacyText.isEmpty
        else { return nil }
        save(legacyText, for: version)
        defaults.removeObject(forKey: Self.legacyVersionKey)
        defaults.removeObject(forKey: Self.legacyTextKey)
        return legacyText
    }

    func save(_ text: String, for version: String) {
        let normalizedVersion = version.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedVersion.isEmpty, !normalizedText.isEmpty else { return }

        var values = entries()
        values[normalizedVersion] = normalizedText
        defaults.set(values, forKey: Self.entriesKey)
    }

    func clear(currentVersion: String) {
        var values = entries()
        values.removeValue(forKey: currentVersion.trimmingCharacters(in: .whitespacesAndNewlines))
        if values.isEmpty {
            defaults.removeObject(forKey: Self.entriesKey)
        } else {
            defaults.set(values, forKey: Self.entriesKey)
        }
    }

    func clear() {
        defaults.removeObject(forKey: Self.entriesKey)
        defaults.removeObject(forKey: Self.legacyVersionKey)
        defaults.removeObject(forKey: Self.legacyTextKey)
    }

    private func entries() -> [String: String] {
        (defaults.dictionary(forKey: Self.entriesKey) as? [String: String]) ?? [:]
    }
}

enum UpdateReleaseNotesText {
    static func normalized(_ notes: String?, version: String) -> String? {
        guard let notes else { return nil }
        let trimmed = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isTitleOnly(trimmed, version: version) else { return nil }
        return trimmed
    }

    static func isTitleOnly(_ notes: String, version: String) -> Bool {
        let normalized = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        return [
            "乾坤戒 macOS v\(version)",
            "乾坤戒 v\(version)",
            "Qiankunjie macOS v\(version)",
        ].contains(normalized)
    }
}
