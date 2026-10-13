import QiankunjieDesignSystem
import SwiftUI

/// 操作成功后的弱提醒：浮层自动消失，不需要用户点击确认。
struct StatusToastView: View {
    let text: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))

            Text(text)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .lineLimit(2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(QiankunjieColors.surface(for: colorScheme), in: Capsule())
        .overlay {
            Capsule()
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        .accessibilityElement(children: .combine)
    }
}

private struct StatusToastModifier: ViewModifier {
    @Binding var message: String?
    var duration: Duration = .milliseconds(2400)

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let message {
                    StatusToastView(text: message)
                        .padding(.top, 10)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .task(id: message) {
                            try? await Task.sleep(for: duration)
                            guard !Task.isCancelled else { return }
                            withAnimation(.easeOut(duration: 0.2)) {
                                self.message = nil
                            }
                        }
                }
            }
            .animation(.easeOut(duration: 0.2), value: message)
    }
}

extension View {
    /// 操作结果的弱提醒：浮在顶部、自动消失，不需要点击确认。
    func statusToast(message: Binding<String?>) -> some View {
        modifier(StatusToastModifier(message: message))
    }
}
