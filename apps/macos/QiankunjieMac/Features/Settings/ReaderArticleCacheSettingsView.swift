import Foundation
import QiankunjieDesignSystem
import QiankunjieReader
import SwiftUI

/// 设置页中的文章正文缓存统计与清理入口。
struct ReaderArticleCacheSettingsView: View {
    let cache: any ReaderArticleCaching
    let webCache: ReaderWebCache

    @State private var statistics: ReaderArticleCacheStatistics?
    @State private var isLoading = true
    @State private var isClearing = false
    @State private var errorMessage: String?
    @State private var isClearConfirmationPresented = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            SettingsRow(
                title: "已缓存正文",
                subtitle: "正文按账号隔离；图片使用阅读器独立的 WebKit 磁盘缓存。"
            ) {
                Text(statisticsSummary)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .monospacedDigit()
            }

            SettingsRowDivider()

            SettingsRow(
                title: "缓存管理",
                subtitle: "正文上限 256 MB、60 天过期；清理会一并删除图片缓存。"
            ) {
                Button(role: .destructive) {
                    isClearConfirmationPresented = true
                } label: {
                    if isClearing {
                        HStack(spacing: 6) {
                            ProgressView()
                                .controlSize(.small)
                            Text("正在清理")
                        }
                    } else {
                        Text("清理缓存")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isLoading || isClearing)
            }

            if let errorMessage {
                Text(errorMessage)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task {
            await refreshStatistics()
        }
        .confirmationDialog(
            "清理本地文章缓存？",
            isPresented: $isClearConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("清理缓存", role: .destructive) {
                Task {
                    await clearCache()
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("清理后再次打开文章会重新加载正文和图片，不会删除收藏、分类或阅读进度。")
        }
    }

    private var statisticsSummary: String {
        if isLoading, statistics == nil {
            return "正在统计..."
        }
        guard let statistics else {
            return "暂时无法读取"
        }
        return "\(statistics.articleCount) 篇 · \(Self.formatBytes(statistics.totalBytes))"
    }

    private func refreshStatistics() async {
        isLoading = true
        errorMessage = nil
        do {
            statistics = try await cache.statistics()
        } catch {
            statistics = nil
            errorMessage = "无法读取本地缓存信息，请稍后重试。"
        }
        isLoading = false
    }

    private func clearCache() async {
        guard !isClearing else { return }
        isClearing = true
        errorMessage = nil
        do {
            try await cache.clear()
            await webCache.clear()
            statistics = try await cache.statistics()
        } catch {
            errorMessage = "缓存清理失败，请稍后重试。"
        }
        isClearing = false
    }

    private static func formatBytes(_ byteCount: Int64) -> String {
        guard byteCount > 0 else {
            return "0 B"
        }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.includesUnit = true
        formatter.isAdaptive = true
        return formatter.string(fromByteCount: byteCount)
    }
}
