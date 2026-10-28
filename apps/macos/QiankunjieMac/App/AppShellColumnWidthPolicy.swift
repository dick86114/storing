import CoreGraphics

/// 为资料库列表与阅读栏提供稳定的初始宽度和可拖动范围。
struct AppShellColumnWidthPolicy: Sendable {
    let defaultContentWidth: CGFloat
    let minimumContentWidth: CGFloat
    let minimumReaderWidth: CGFloat

    init(
        defaultContentWidth: CGFloat = 620,
        minimumContentWidth: CGFloat = 340,
        minimumReaderWidth: CGFloat = 320
    ) {
        self.defaultContentWidth = defaultContentWidth
        self.minimumContentWidth = minimumContentWidth
        self.minimumReaderWidth = minimumReaderWidth
    }

    /// 用户拖动后的宽度必须独立于阅读器内容，避免切换文章时由布局系统重新分配。
    func contentColumnWidth(
        workspaceWidth: CGFloat,
        overrideWidth: CGFloat? = nil
    ) -> (minimum: CGFloat, width: CGFloat, maximum: CGFloat) {
        let maximumWidth = max(
            minimumContentWidth,
            workspaceWidth - minimumReaderWidth
        )
        let requestedWidth = overrideWidth ?? defaultContentWidth

        return (
            minimum: minimumContentWidth,
            width: min(max(requestedWidth, minimumContentWidth), maximumWidth),
            maximum: maximumWidth
        )
    }

    /// 拖拽始终以手势开始时的宽度为基准，避免分隔条移动后产生坐标反馈。
    func draggedContentWidth(
        startingWidth: CGFloat,
        translation: CGFloat,
        workspaceWidth: CGFloat
    ) -> CGFloat {
        let bounds = contentColumnWidth(workspaceWidth: workspaceWidth)
        return min(
            max(startingWidth + translation, bounds.minimum),
            bounds.maximum
        )
    }
}
