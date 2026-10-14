import QiankunjieCollect
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

/// 历史任务列表栏（左侧列表 + 右侧正文，与资料库列表栏同构）。
/// 顶部工具栏：标题 + 计数 + 采集（浮出弹窗）/ 刷新 / 清理；点击任务记录在右侧打开正文。
struct CollectHistoryView: View {
    @Bindable var model: CollectModel
    let onOpenArticle: @MainActor (CollectJob) -> Void
    /// 右侧当前打开的正文（用于高亮列表行）。
    var selectedArticleID: Int?
    /// 未登录时点击「登录」。
    var onRequestLogin: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme
    @State private var isRefreshHovered = false
    @State private var showsCollectPopover = false

    var body: some View {
        VStack(spacing: 0) {
            if model.userID == nil {
                guestView
            } else {
                toolbar

                Rectangle()
                    .fill(QiankunjieColors.outline(for: colorScheme))
                    .frame(height: 1)

                CollectTasksView(
                    model: model,
                    selectedArticleID: selectedArticleID,
                    onOpenArticle: onOpenArticle
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("历史任务")
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                Text(subtitle)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)
            }
            .layoutPriority(1)

            Spacer(minLength: 12)

            Button {
                showsCollectPopover = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.rectangle.on.rectangle")
                        .font(.system(size: 11, weight: .medium))
                    Text("采集")
                        .font(.system(size: 12, weight: .medium))
                        .lineLimit(1)
                }
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                .padding(.horizontal, 9)
                .frame(height: 28)
                .background(
                    RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                        .fill(QiankunjieColors.accent(for: colorScheme).opacity(0.14))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                        .strokeBorder(QiankunjieColors.accent(for: colorScheme).opacity(0.28))
                }
            }
            .buttonStyle(.plain)
            .help("粘贴公开网页链接开始采集")
            .popover(isPresented: $showsCollectPopover, arrowEdge: .bottom) {
                CollectQuickPopoverView(
                    model: model,
                    onRequestLogin: {
                        showsCollectPopover = false
                        onRequestLogin()
                    },
                    onFinished: {
                        showsCollectPopover = false
                    }
                )
            }

            refreshButton
            clearFinishedButton
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private var subtitle: String {
        guard !model.jobs.isEmpty else { return "还没有采集记录" }

        let running = model.jobs.filter { $0.status == "pending" || $0.status == "running" }.count
        var parts = ["共 \(model.jobs.count) 条"]
        if running > 0 {
            parts.append("\(running) 个进行中")
        }
        if model.hasMore {
            parts.append("可继续加载")
        }
        return parts.joined(separator: " · ")
    }

    private var refreshButton: some View {
        Button {
            Task {
                await model.refreshJobs()
            }
        } label: {
            ZStack {
                if model.isRefreshingJobs {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                        .scaleEffect(isRefreshHovered ? 1.08 : 1)
                        .foregroundStyle(
                            isRefreshHovered
                                ? QiankunjieColors.accent(for: colorScheme)
                                : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
            }
            .frame(width: 28, height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background { controlSurface }
        .onHover { hovering in
            isRefreshHovered = hovering
        }
        .disabled(
            model.isRefreshingJobs
                || model.isLoadingMoreJobs
                || model.isClearingFinishedJobs
        )
        .help("刷新任务")
    }

    private var clearFinishedButton: some View {
        Button {
            model.isClearConfirmationPresented = true
        } label: {
            Image(systemName: "trash.slash")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background { controlSurface }
        .disabled(
            model.jobs.isEmpty
                || model.isRefreshingJobs
                || model.isLoadingMoreJobs
                || model.isClearingFinishedJobs
        )
        .help("清理已完成和失败的任务")
    }

    private var controlSurface: some View {
        RoundedRectangle(cornerRadius: QiankunjieRadius.control)
            .fill(QiankunjieColors.surface(for: colorScheme))
            .overlay {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
    }

    private var guestView: some View {
        ContentUnavailableView(
            "请先登录",
            systemImage: "person.badge.key",
            description: Text("登录后可以查看历史采集任务")
        )
    }
}

struct CollectJobRow: View {
    let job: CollectJob
    /// 右侧正文是否正显示这条任务的正文。
    var isSelected = false
    var isMutating = false
    var onOpenArticle: (() -> Void)?
    var onRetry: (() -> Void)?
    var onDelete: (() -> Void)?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                statusIcon

                VStack(alignment: .leading, spacing: 5) {
                    Text(job.title ?? job.url)
                        .qiankunjieFont(.titleMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)
                        .truncationMode(.middle)

                    HStack(spacing: 8) {
                        Text(displayStatus)

                        if let host = displayHost {
                            Label(host, systemImage: "link")
                        }

                        if let date = displayDate {
                            Label(date.formatted(.relative(presentation: .named)), systemImage: "clock")
                        }
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)

                    if job.status == "failed" {
                        Text(job.errorSummary ?? job.error ?? "采集失败")
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(
                                colorScheme == .dark
                                    ? QiankunjieColors.darkError
                                    : QiankunjieColors.lightError
                            )
                            .lineLimit(3)

                        if let hint = job.errorHint {
                            Text(hint)
                                .qiankunjieFont(.labelMedium)
                                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        }
                    }
                }

                Spacer(minLength: 0)
            }

            if actionsAllowed {
                HStack(spacing: 8) {
                    if job.status == "failed" {
                        Button(action: retryJob) {
                            HStack(spacing: 6) {
                                if isMutating {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Image(systemName: "arrow.clockwise")
                                }
                                Text(isMutating ? "正在重试" : "重试")
                            }
                        }
                        .disabled(isMutating)
                    }

                    if job.isTerminal {
                        Button(action: deleteJob) {
                            Label("删除任务", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .fill(
                    isSelected
                        ? QiankunjieColors.accent(for: colorScheme).opacity(0.12)
                        : QiankunjieColors.surface(for: colorScheme)
                )
        }
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .strokeBorder(
                    isSelected
                        ? QiankunjieColors.accent(for: colorScheme).opacity(0.55)
                        : QiankunjieColors.outline(for: colorScheme)
                )
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard onOpenArticle != nil else { return }
            openArticle()
        }
        .help(onOpenArticle == nil ? "" : "在右侧打开正文")
        .accessibilityAddTraits(onOpenArticle == nil ? [] : .isButton)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var actionsAllowed: Bool {
        onRetry != nil || onDelete != nil
    }

    private var statusIcon: some View {
        Group {
            switch job.status {
            case "completed":
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            case "failed":
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            default:
                ProgressView()
                    .controlSize(.small)
            }
        }
        .frame(width: 22)
    }

    /// 任务来源域名（与资料库列表行的「来源」位置一致）。
    private var displayHost: String? {
        URL(string: job.normalizedURL)?.host ?? URL(string: job.url)?.host
    }

    /// 任务时间：完成后取完成时间，否则取创建时间。
    private var displayDate: Date? {
        job.finishedAt ?? job.createdAt
    }

    private var displayStatus: String {
        switch job.status {
        case "pending": "排队中"
        case "running": "采集中 · \(job.stage)"
        case "completed": "采集完成"
        case "failed": "采集失败"
        default: job.status
        }
    }

    private func openArticle() {
        onOpenArticle?()
    }

    private func retryJob() {
        onRetry?()
    }

    private func deleteJob() {
        onDelete?()
    }
}
