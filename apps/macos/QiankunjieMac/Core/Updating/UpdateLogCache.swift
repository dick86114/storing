import Foundation

/// 更新日志缓存与当前安装版本绑定，版本变化时自动失效。
struct UpdateLogCache {
    private static let versionKey = "update.log.cached.version"
    private static let textKey = "update.log.cached.text"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func read(currentVersion: String) -> String? {
        guard
            defaults.string(forKey: Self.versionKey) == currentVersion,
            let text = defaults.string(forKey: Self.textKey),
            !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            clear()
            return nil
        }
        return text
    }

    func save(_ text: String, for version: String) {
        defaults.set(version, forKey: Self.versionKey)
        defaults.set(text, forKey: Self.textKey)
    }

    func clear() {
        defaults.removeObject(forKey: Self.versionKey)
        defaults.removeObject(forKey: Self.textKey)
    }
}
