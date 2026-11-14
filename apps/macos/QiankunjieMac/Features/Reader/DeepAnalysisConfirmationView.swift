import QiankunjieDesignSystem
import SwiftUI

struct DeepAnalysisConfirmationView: View {
    let articleTitle: String?
    let onCancel: () -> Void
    let onConfirm: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private let highlights = [
        "核心论点、论证链路与关键数据",
        "不同观点、风险与局限",
        "可执行的行动指引与延伸问题",
    ]

    var body: some View {
        ZStack {
            Color.black.opacity(colorScheme == .dark ? 0.48 : 0.28)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 18) {
                header
                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("生成深度报告？")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    Text("AI 会解析全文，整理成一份更专业、易懂、可行动的结构化报告。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: 10) {
                    ForEach(highlights, id: \.self) { highlight in
                        HStack(alignment: .top, spacing: 9) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                            Text(highlight)
                                .font(.callout)
                                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        }
                    }
                }

                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    Text("任务会在后台异步生成。提交后可以继续阅读或离开页面，完成后会通过系统通知和文章列表标记提醒你。")
                        .font(.footnote)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.64),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )

                HStack(spacing: 10) {
                    Spacer(minLength: 0)
                    Button("取消", action: onCancel)
                        .buttonStyle(.bordered)
                        .keyboardShortcut(.cancelAction)
                    Button(action: onConfirm) {
                        Label("确认生成", systemImage: "bubbles.and.sparkles.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                }
            }
            .padding(24)
            .frame(width: 500)
            .background(
                QiankunjieColors.surface(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
            .shadow(color: .black.opacity(0.24), radius: 28, y: 14)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("生成深度报告确认")
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bubbles.and.sparkles.fill")
                .font(.system(size: 21, weight: .semibold))
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                .frame(width: 42, height: 42)
                .background(
                    QiankunjieColors.accent(for: colorScheme).opacity(0.14),
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text("AI 增强阅读")
                    .font(.headline)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Text("深度报告")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                if let articleTitle, !articleTitle.isEmpty {
                    Text("《\(articleTitle)》")
                        .font(.footnote)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 0)
        }
    }
}
