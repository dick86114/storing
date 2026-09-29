import Foundation
import QiankunjieCollect

@Observable
@MainActor
final class GlobalShortcutSettings {
    static let storageKey = "quickCollect.globalShortcut"

    private let defaults: UserDefaults
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
        guard shortcut != self.shortcut else { return }

        self.shortcut = shortcut
        defaults.set(shortcut.rawValue, forKey: Self.storageKey)
    }
}
