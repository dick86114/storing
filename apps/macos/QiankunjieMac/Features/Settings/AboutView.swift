import AppKit
import QiankunjieDesignSystem
import QiankunjieUpdating
import SwiftUI

/// 「关于」窗口：版本信息、仓库地址、当前版本更新日志与历史版本入口。
struct AboutView: View {
    static let repositoryURL = URL(string: "https://github.com/dick86114/storing")!
    static let releasesURL = URL(string: "https://github.com/dick86114/storing/releases")!

    @State private var model: UpdateSettingsModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    init() {
        _model = State(initialValue: UpdateSettingsModel(
            currentVersion: QiankunjieMacMetadata.appVersion
        ))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            brand

            Divider()

            repositoryRow

            updateLog

            Divider()

            HStack(spacing: 8) {
                Spacer(minLength: 0)

                Button("查看历史版本") {
                    NSWorkspace.shared.open(Self.releasesURL)
                }

                Button("关闭") {
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 460, alignment: .leading)
        .background(QiankunjieColors.background(for: colorScheme))
        .task {
            await model.fetchUpdateLog()
        }
    }

    private var brand: some View {
        HStack(spacing: 14) {
            BrandAssetName.brandLogo.image
                .resizable()
                .scaledToFit()
                .frame(width: 52, height: 52)
                .accessibilityLabel(BrandAssetName.brandLogo.accessibilityLabel)

            VStack(alignment: .leading, spacing: 3) {
                Text(QiankunjieMacMetadata.displayName)
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                Text("v\(QiankunjieMacMetadata.appVersion)")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .monospacedDigit()
            }

            Spacer(minLength: 0)
        }
    }

    private var repositoryRow: some View {
        SettingsRow(
            title: "GitHub 仓库",
            subtitle: "开源地址，欢迎提交问题与建议。",
            controlWidth: 110
        ) {
            Button("打开仓库") {
                NSWorkspace.shared.open(Self.repositoryURL)
            }
        }
    }

    private var updateLog: some View {
        SettingsBlockRow(
            title: "本版本更新日志",
            subtitle: "v\(QiankunjieMacMetadata.appVersion) 的更新说明"
        ) {
            VStack(alignment: .leading, spacing: 8) {
                if model.isFetchingUpdateLog {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在获取更新日志")
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                    .frame(height: 260, alignment: .topLeading)
                } else if let log = model.updateLog, !log.isEmpty {
                    // 固定高度保证多行长日志也能看全，超出部分在区域内滚动。
                    ScrollView {
                        Text(log)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(height: 260)
                } else {
                    Text(model.updateLogErrorText ?? "暂无更新日志")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .frame(height: 260, alignment: .topLeading)
                }

                SettingsActionsRow {
                    Button("重新获取") {
                        Task {
                            await model.fetchUpdateLog()
                        }
                    }
                    .disabled(model.isFetchingUpdateLog)
                }
            }
        }
    }
}
