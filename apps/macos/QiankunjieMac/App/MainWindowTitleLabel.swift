import QiankunjieDesignSystem
import SwiftUI

struct MainWindowTitleLabel: View {
    let onOpenVersionDetails: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovering = false

    var body: some View {
        Button(action: onOpenVersionDetails) {
            HStack(spacing: 8) {
                BrandAssetName.brandLogo.image
                    .resizable()
                    .scaledToFit()
                    .frame(width: 24, height: 24)
                    .accessibilityLabel(BrandAssetName.brandLogo.accessibilityLabel)

                VStack(alignment: .leading, spacing: 1) {
                    Text(QiankunjieMacMetadata.displayName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(1)

                    Text("v\(QiankunjieMacMetadata.appVersion)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .monospacedDigit()
                        .lineLimit(1)
                }

                Image(systemName: "info.circle")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .opacity(isHovering ? 1 : 0.52)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                    .fill(
                        isHovering
                            ? QiankunjieColors.surfaceVariant(for: colorScheme)
                            : Color.clear
                    )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
        }
        .help("查看当前版本更新内容")
        .accessibilityLabel("\(QiankunjieMacMetadata.displayName) v\(QiankunjieMacMetadata.appVersion)，查看当前版本更新内容")
    }
}
