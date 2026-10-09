import SwiftUI

/// 应用外观偏好；`system` 表示继续跟随 macOS 系统外观。
public enum AppearancePreference: String, CaseIterable, Codable, Identifiable, Sendable {
    case system
    case light
    case dark

    public var id: String {
        rawValue
    }

    public var displayName: String {
        switch self {
        case .system: "跟随系统"
        case .light: "浅色"
        case .dark: "深色"
        }
    }

    /// 可选颜色方案；`system` 返回 nil。
    ///
    /// 主窗口现在使用 `resolvedColorScheme(system:)` 传入明确值，避免 SwiftUI
    /// 动态移除旧偏好时延迟刷新。该方法保留给需要区分“未指定”和明确外观的场景。
    public var preferredColorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    /// 把“跟随系统”解析成明确的 SwiftUI 颜色方案。
    ///
    /// SwiftUI 对动态移除 `preferredColorScheme` 的响应并不总是立即生效；
    /// 主窗口改传明确值后，浅色切回跟随系统时可以直接从 `.light` 变为 `.dark`，
    /// 不需要依赖窗口重排或重新激活来刷新。
    public func resolvedColorScheme(system systemColorScheme: ColorScheme) -> ColorScheme {
        switch self {
        case .system: systemColorScheme
        case .light: .light
        case .dark: .dark
        }
    }
}
