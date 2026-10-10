import QiankunjieDesignSystem
import SwiftUI

struct MainWindowTitleLabel: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
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
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
    }
}
