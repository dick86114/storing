import AppKit
import QiankunjieAuth

/// 把外观偏好同步到 AppKit 应用层。
///
/// `preferredColorScheme` 只能影响托管它的那个窗口，菜单栏快捷收集面板等独立窗口
/// 不会跟随，因此统一设置 `NSApp.appearance`，让整个应用使用同一套外观。
/// `跟随系统` 对应 `nil`，表示撤销强制外观、重新读取系统设置。
@MainActor
enum AppearanceApplier {
    static func apply(_ preference: AppearancePreference) {
        let application = NSApplication.shared
        application.appearance = preference.appKitAppearance
        guard preference == .system else { return }
        // 窗口自身的 appearance 优先级高于 NSApp，若不清理，之前强制过的窗口
        // 会继续停留在旧外观。切回跟随系统时统一清掉。
        for window in application.windows {
            window.appearance = nil
        }
    }
}

extension AppearancePreference {
    /// 映射到 AppKit 外观；`nil` 表示跟随系统。
    var appKitAppearance: NSAppearance? {
        switch self {
        case .system: nil
        case .light: NSAppearance(named: .aqua)
        case .dark: NSAppearance(named: .darkAqua)
        }
    }
}
