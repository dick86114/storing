import AppKit
import QiankunjieAuth

/// 把外观偏好同步到 AppKit 应用层。
///
/// `preferredColorScheme` 只能影响托管它的那个窗口，菜单栏快捷收集面板等独立窗口
/// 不会跟随，因此统一设置 `NSApp.appearance`，让整个应用使用同一套外观。
/// `跟随系统` 对应 `nil`，表示撤销强制外观、重新读取系统设置。
@MainActor
enum AppearanceApplier {
    private static var currentPreference: AppearancePreference = .system
    private static var systemAppearanceObservation: NSKeyValueObservation?
    private static var isApplyingAppearance = false

    static func apply(_ preference: AppearancePreference) {
        currentPreference = preference
        installSystemAppearanceObserverIfNeeded()
        applyImmediately(preference)
        guard preference == .system else { return }
        // SwiftUI 会在同一帧里把 preferredColorScheme 落到窗口上，
        // 再等一个渲染周期确认一次，避免窗口残留上一次的强制外观。
        Task { @MainActor in
            applyImmediately(preference)
        }
    }

    private static func installSystemAppearanceObserverIfNeeded() {
        guard systemAppearanceObservation == nil else { return }
        systemAppearanceObservation = NSApplication.shared.observe(
            \.effectiveAppearance,
            options: [.new]
        ) { _, _ in
            MainActor.assumeIsolated {
                guard currentPreference == .system else { return }
                applyImmediately(.system)
            }
        }
    }

    private static func applyImmediately(_ preference: AppearancePreference) {
        guard !isApplyingAppearance else { return }
        isApplyingAppearance = true
        defer { isApplyingAppearance = false }

        let application = NSApplication.shared
        let forcedAppearance = preference.appKitAppearance
        application.appearance = forcedAppearance
        // SwiftUI 的 preferredColorScheme 只作用于它托管的窗口，菜单栏面板等
        // 独立窗口需要自己同步。切回跟随系统时，仅把窗口 appearance 清空不会
        // 立即触发部分 SwiftUI 窗口重新解析颜色方案；显式写入当前系统外观可
        // 强制本帧刷新，后续系统外观变化再由通知统一更新。
        let windowAppearance = resolvedWindowAppearance(for: preference, application: application)
        for window in application.windows {
            window.appearance = windowAppearance
            window.contentView?.needsDisplay = true
            window.contentView?.displayIfNeeded()
        }
    }

    static func resolvedWindowAppearance(
        for preference: AppearancePreference,
        application: NSApplication = .shared
    ) -> NSAppearance? {
        preference.appKitAppearance ?? application.effectiveAppearance
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
