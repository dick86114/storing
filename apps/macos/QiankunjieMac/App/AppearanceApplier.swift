import AppKit
import QiankunjieAuth

/// 把外观偏好同步到 AppKit 应用层。
///
/// SwiftUI 的 `preferredColorScheme` 只作用在托管它的窗口上，菜单栏快捷收集面板
/// 等独立面板不会跟随。这里同时设置 `NSApp.appearance`，让整个应用（含面板）
/// 使用同一套外观；`跟随系统` 对应 `nil`，即撤销强制外观、重新读取系统设置。
@MainActor
enum AppearanceApplier {
    static func apply(_ preference: AppearancePreference) {
        NSApp.appearance = preference.appKitAppearance
        guard preference == .system else { return }
        // 窗口自身的 appearance 优先级高于 NSApp，若不清理，之前强制过的窗口
        // 会继续停留在旧外观。切回跟随系统时统一清掉。
        for window in NSApp.windows {
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
