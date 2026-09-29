import Foundation
import QiankunjieCollect

@Observable
@MainActor
final class GlobalShortcutSettings {
    static let storageKey = "quickCollect.globalShortcut"

    private let defaults: UserDefaults
    private(set) var registrationMessage: String?
    var shortcut: GlobalShortcut {
        didSet {
            guard shortcut != oldValue else { return }
            defaults.set(shortcut.rawValue, forKey: Self.storageKey)
        }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let storedValue = defaults.string(forKey: Self.storageKey)
        if let shortcut = storedValue.flatMap(GlobalShortcut.init(rawValue:)) {
            self.shortcut = shortcut
        } else {
            if storedValue != nil {
                defaults.removeObject(forKey: Self.storageKey)
            }
            self.shortcut = .default
        }
    }

    func select(_ shortcut: GlobalShortcut) {
        select(shortcut) { _ in true }
    }

    @discardableResult
    func select(
        _ shortcut: GlobalShortcut,
        register: @MainActor (GlobalShortcut) -> Bool
    ) -> Bool {
        guard shortcut != self.shortcut else { return true }

        guard register(shortcut) else {
            registrationMessage = "全局快捷键注册失败，已保留原快捷键。"
            return false
        }

        self.shortcut = shortcut
        defaults.set(shortcut.rawValue, forKey: Self.storageKey)
        registrationMessage = nil
        return true
    }
}
