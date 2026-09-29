import Foundation
import QiankunjieCollect
import Testing
@testable import QiankunjieMac

@MainActor
struct ShortcutSettingsTests {
    @Test func 快捷键选择会持久化并在重新加载时保留() throws {
        let (defaults, suiteName) = try 临时偏好存储()
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        defaults.set(
            GlobalShortcut.controlOptionS.rawValue,
            forKey: GlobalShortcutSettings.storageKey
        )

        let first = GlobalShortcutSettings(defaults: defaults)
        first.shortcut = .shiftCommandS
        let second = GlobalShortcutSettings(defaults: defaults)

        #expect(first.shortcut == .shiftCommandS)
        #expect(second.shortcut == .shiftCommandS)
        #expect(
            defaults.string(forKey: GlobalShortcutSettings.storageKey)
                == GlobalShortcut.shiftCommandS.rawValue
        )
    }

    @Test func 无效或过期存储值回退默认快捷键() throws {
        let (defaults, suiteName) = try 临时偏好存储()
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        defaults.set(
            "commandOptionS",
            forKey: GlobalShortcutSettings.storageKey
        )

        let settings = GlobalShortcutSettings(defaults: defaults)

        #expect(settings.shortcut == .default)
        #expect(
            defaults.string(forKey: GlobalShortcutSettings.storageKey) == nil
        )
    }
}

private func 临时偏好存储() throws -> (defaults: UserDefaults, suiteName: String) {
    let suiteName = "com.idickies.storing.macos.tests.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        throw NSError(
            domain: "ShortcutSettingsTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "无法创建临时偏好存储"]
        )
    }
    return (defaults, suiteName)
}
