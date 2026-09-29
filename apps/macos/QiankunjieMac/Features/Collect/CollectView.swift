import QiankunjieCollect
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct CollectView: View {
    @Bindable var model: CollectModel
    let onOpenArticle: @MainActor (CollectJob) -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if model.userID == nil {
                guestView
            } else {
                submitHeader

                Rectangle()
                    .fill(QiankunjieColors.outline(for: colorScheme))
                    .frame(height: 1)

                currentJobView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var guestView: some View {
        ContentUnavailableView(
            "请先登录",
            systemImage: "person.badge.key",
            description: Text("登录后可以创建和查看采集任务")
        )
    }

    private var submitHeader: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("新建采集")
                .font(QiankunjieTypography.headlineSmall)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))

            HStack(spacing: 10) {
                TextField("粘贴公开网页链接", text: $model.urlDraft)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .disabled(model.isSubmitting)
                    .accessibilityLabel("网页链接")
                    .onSubmit(submit)

                Button(action: submit) {
                    HStack(spacing: 6) {
                        if model.isSubmitting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "plus.rectangle.on.rectangle")
                        }
                        Text(model.isSubmitting ? "正在提交" : "采集")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!model.canSubmit)
            }

            if let message = model.inputErrorMessage {
                Text(message)
                    .font(QiankunjieTypography.bodyMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            }

            if let message = model.submitErrorMessage {
                Text(message)
                    .font(QiankunjieTypography.bodyMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            }

            if let message = model.actionErrorMessage {
                Text(message)
                    .font(QiankunjieTypography.bodyMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }

    @ViewBuilder
    private var currentJobView: some View {
        if let job = model.currentJob {
            ScrollView {
                CollectJobRow(
                    job: job,
                    isMutating: model.mutatingJobIDs.contains(job.id),
                    onOpenArticle: {
                        onOpenArticle(job)
                    },
                    onRetry: {
                        Task {
                            await model.retry(jobID: job.id)
                        }
                    }
                )
                .padding(18)
            }
        } else {
            VStack(spacing: 10) {
                Image(systemName: "tray.and.arrow.down")
                    .font(.title2)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                Text("提交链接后会显示采集进度")
                    .font(QiankunjieTypography.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func submit() {
        guard model.canSubmit else { return }

        Task {
            await model.submit(model.urlDraft)
        }
    }
}

struct CollectJobRow: View {
    let job: CollectJob
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
                        .font(QiankunjieTypography.titleMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)

                    Text(displayStatus)
                        .font(QiankunjieTypography.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                    if job.status == "failed" {
                        Text(job.errorSummary ?? job.error ?? "采集失败")
                            .font(QiankunjieTypography.bodyMedium)
                            .foregroundStyle(
                                colorScheme == .dark
                                    ? QiankunjieColors.darkError
                                    : QiankunjieColors.lightError
                            )
                            .lineLimit(3)

                        if let hint = job.errorHint {
                            Text(hint)
                                .font(QiankunjieTypography.labelMedium)
                                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        }
                    }
                }

                Spacer(minLength: 0)
            }

            if actionsAllowed {
                HStack(spacing: 8) {
                    if job.status == "completed", job.articleId != nil {
                        Button(action: openArticle) {
                            Label("打开文章", systemImage: "doc.text")
                        }
                    }

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
                .fill(QiankunjieColors.surface(for: colorScheme))
        }
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var actionsAllowed: Bool {
        onOpenArticle != nil || onRetry != nil || onDelete != nil
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
