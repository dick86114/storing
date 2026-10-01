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

    /// 传给 SwiftUI `preferredColorScheme` 的取值。
    ///
    /// `system` 必须返回 nil：nil 表示不写入任何偏好，窗口会重新跟随系统外观。
    /// 如果这里返回当前环境已经解析出的颜色方案，切换回“跟随系统”时就会把
    /// 上一次的强制外观再写回去，导致设置看起来无效。
    public var preferredColorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
