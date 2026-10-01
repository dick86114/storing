import CoreGraphics

/// 主窗口尺寸定义。
enum MainWindowMetrics {
    /// 未显式设置尺寸时，SwiftUI 按内容理想尺寸开窗，实测约为 1650×1074。
    static let previousDefaultSize = CGSize(width: 1650, height: 1074)

    /// 首次打开使用的默认窗口尺寸：在实测默认值基础上宽高各增加一倍。
    /// 数值超出屏幕可用区域时，由 `MainWindowSizer` 收敛到屏幕范围内。
    static let defaultSize = CGSize(
        width: previousDefaultSize.width * 2,
        height: previousDefaultSize.height * 2
    )

    /// 标记本机是否已经应用过默认窗口尺寸；只干预首次打开。
    static let defaultSizeAppliedKey = "main.window.hasAppliedDefaultSize"

    /// 将目标尺寸收敛到屏幕可用区域，避免窗口超出屏幕。
    static func resolvedSize(forVisibleFrame visibleFrame: CGSize) -> CGSize {
        CGSize(
            width: min(defaultSize.width, visibleFrame.width),
            height: min(defaultSize.height, visibleFrame.height)
        )
    }

    /// 是否需要套用新的默认尺寸。
    ///
    /// 从未应用过时套用；已经应用过但窗口仍是旧的默认尺寸时也套用，
    /// 让升级上来的用户不需要手动清理窗口状态就能看到变化；
    /// 用户自己调整过的其他尺寸一律不动。
    static func shouldApplyDefaultSize(isApplied: Bool, currentFrameSize: CGSize) -> Bool {
        guard isApplied else { return true }
        return currentFrameSize == previousDefaultSize
    }
}
