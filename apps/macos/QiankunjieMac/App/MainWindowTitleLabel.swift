import SwiftUI

/// 窗口标题文案：「乾坤戒 v版本号」。
///
/// 由内容列（列表列）的工具栏承载，落在灰色工具栏区域的最左侧。
/// 放在窗口级导航位会被侧边栏宽度挤压：展开时容易居中，收起时版本号被裁掉。
struct MainWindowTitleLabel: View {
    /// 侧边栏收起时工具栏左侧槽位只有约 90pt，放不下版本号，只保留应用名。
    let showsVersion: Bool

    var body: some View {
        Text(title)
        .fixedSize()
        .allowsHitTesting(false)
    }

    /// 用一段属性字符串渲染，避免两个 Text 叠加时被工具栏压缩到只剩一半。
    private var title: AttributedString {
        var text = AttributedString(QiankunjieMacMetadata.displayName)
        text.font = .headline

        guard showsVersion else { return text }

        var version = AttributedString(" v" + QiankunjieMacMetadata.appVersion)
        version.font = .caption
        version.foregroundColor = .secondary

        text.append(version)
        return text
    }
}
