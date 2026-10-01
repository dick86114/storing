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
        applyImmediately(preference)
        guard preference == .system else { return }
        // SwiftUI 会在同一帧里把 preferredColorScheme 落到窗口上，
        // 再等一个渲染周期确认一次，避免窗口残留上一次的强制外观。
        Task { @MainActor in
            applyImmediately(preference)
        }
    }

    private static func applyImmediately(_ preference: AppearancePreference) {
        let application = NSApplication.shared
        let appearance = preference.appKitAppearance
        application.appearance = appearance
        // SwiftUI 的 preferredColorScheme 只作用于它托管的窗口，菜单栏面板等
        // 独立窗口需要自己同步。窗口自身的 appearance 优先级高于 NSApp，
        // 所以每次都要显式写入；跟随系统时写 nil，窗口才会重新继承系统外观。
        for window in application.windows {
            window.appearance = appearance
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
