import QiankunjieCollect
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct CollectTasksView: View {
    @Bindable var model: CollectModel
    let onOpenArticle: @MainActor (CollectJob) -> Void
    @Environment(\.colorScheme) private var colorScheme

    private var deletionConfirmation: Binding<Bool> {
        Binding(
            get: { model.pendingDeletionJobID != nil },
            set: { isPresented in
                if !isPresented {
                    model.pendingDeletionJobID = nil
                }
            }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar

            Rectangle()
                .fill(QiankunjieColors.outline(for: colorScheme))
                .frame(height: 1)

            if let message = model.refreshErrorMessage ?? model.actionErrorMessage {
                Text(message)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
            }

            content
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .confirmationDialog(
            "删除这条采集任务？",
            isPresented: deletionConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除任务", role: .destructive) {
                guard let jobID = model.pendingDeletionJobID else { return }

                Task {
                    await model.delete(jobID: jobID)
                }
            }
            Button("取消", role: .cancel) {
                model.pendingDeletionJobID = nil
            }
        } message: {
            Text("删除后无法恢复。运行中的任务不会删除。")
        }
        .confirmationDialog(
            "清理已完成和失败的任务？",
            isPresented: $model.isClearConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("清理任务", role: .destructive) {
                Task {
                    await model.clearFinished()
                }
            }
            Button("取消", role: .cancel) {
                model.isClearConfirmationPresented = false
            }
        } message: {
            Text("只会删除当前账号的已完成和失败任务。")
        }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            Text("采集任务")
                .qiankunjieFont(.headlineSmall)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))

            Spacer()

            Button {
                Task {
                    await model.refreshJobs()
                }
            } label: {
                if model.isRefreshingJobs {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderless)
            .disabled(
                model.isRefreshingJobs
                    || model.isLoadingMoreJobs
                    || model.isClearingFinishedJobs
                    || model.userID == nil
            )
            .help("刷新任务")

            Button {
                model.isClearConfirmationPresented = true
            } label: {
                Image(systemName: "trash.slash")
            }
            .buttonStyle(.borderless)
            .disabled(
                model.userID == nil
                    || model.jobs.isEmpty
                    || model.isRefreshingJobs
                    || model.isLoadingMoreJobs
                    || model.isClearingFinishedJobs
            )
            .help("清理已完成和失败的任务")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }

    @ViewBuilder
    private var content: some View {
        if model.userID == nil {
            ContentUnavailableView(
                "请先登录",
                systemImage: "person.badge.key",
                description: Text("登录后可以查看当前账号的采集任务")
            )
        } else {
            switch model.displayState {
            case .loading:
                loadingView
            case .empty:
                emptyView
            case .error:
                errorView
            case .content:
                taskList
            }
        }
    }

    private var taskList: some View {
        ThinScrollView {
            LazyVStack(spacing: 8) {
                ForEach(model.jobs, id: \.id) { job in
                    CollectJobRow(
                        job: job,
                        isMutating: model.mutatingJobIDs.contains(job.id),
                        onOpenArticle: job.articleId == nil ? nil : {
                            onOpenArticle(job)
                        },
                        onRetry: job.status == "failed" ? { retry(job) } : nil,
                        onDelete: job.isTerminal ? {
                            model.pendingDeletionJobID = job.id
                        } : nil
                    )
                }

                if model.hasMore {
                    Button {
                        Task {
                            await model.loadMoreJobs()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            if model.isLoadingMoreJobs {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Image(systemName: "chevron.down.circle")
                            }
                            Text(model.isLoadingMoreJobs ? "正在加载" : "加载更多")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(
                        model.isLoadingMoreJobs
                            || model.isClearingFinishedJobs
                            || model.userID == nil
                    )
                    .padding(.top, 4)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .refreshable {
            await model.refreshJobs()
        }
    }

    private var loadingView: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("正在加载采集任务")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func retry(_ job: CollectJob) {
        Task {
            await model.retry(jobID: job.id)
        }
    }

    private var emptyView: some View {
        ContentUnavailableView(
            "暂无采集任务",
            systemImage: "tray",
            description: Text("在采集页提交公开链接后，任务会显示在这里")
        )
    }

    private var errorView: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )

            Text(model.refreshErrorMessage ?? "加载采集任务失败")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .multilineTextAlignment(.center)

            Button {
                Task {
                    await model.refreshJobs()
                }
            } label: {
                Label("重试", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
