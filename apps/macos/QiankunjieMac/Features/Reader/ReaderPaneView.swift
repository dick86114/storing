import AppKit
import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieNetworking
import QiankunjieReader
import SwiftUI

struct ReaderPaneView: View {
    let selection: ReaderSelection?
    let userID: Int?
    let appFont: AppFontPreference
    let readerContentWidth: ReaderContentWidthPreference
    let onReaderContentWidthChange: (ReaderContentWidthPreference) -> Void
    let positionStore: any ReaderPositionStoring
    let networkClient: any ReaderNetworkClient
    let onClose: () -> Void
    let onLibraryDidChange: () -> Void

    @State private var model: ReaderModel
    @State private var pendingAction: ReaderArticleAction?
    @State private var selectedImageURL: URL?
    @State private var titleHovered = false
    @State private var isRenaming = false
    @State private var isPurgeConfirming = false
    @State private var renameDraft = ""
    @State private var titleCopied = false
    @State private var showCategoryReason = false
    @State private var isCategoryEditorPresented = false
    @Environment(\.colorScheme) private var colorScheme

    init(
        selection: ReaderSelection?,
        userID: Int?,
        appFont: AppFontPreference = .standard,
        readerContentWidth: ReaderContentWidthPreference = .normal,
        onReaderContentWidthChange: @escaping (ReaderContentWidthPreference) -> Void = { _ in },
        positionStore: any ReaderPositionStoring,
        networkClient: any ReaderNetworkClient = APIClient(),
        onClose: @escaping () -> Void,
        onLibraryDidChange: @escaping () -> Void
    ) {
        self.selection = selection
        self.userID = userID
        self.appFont = appFont
        self.readerContentWidth = readerContentWidth
        self.onReaderContentWidthChange = onReaderContentWidthChange
        self.positionStore = positionStore
        self.networkClient = networkClient
        self.onClose = onClose
        self.onLibraryDidChange = onLibraryDidChange
        _model = State(initialValue: ReaderModel(
            client: networkClient,
            positionStore: positionStore,
            userID: userID
        ))
    }

    var body: some View {
        Group {
            if let selection, let article = model.article, article.id == selection.articleID {
                reader(article)
            } else if selection != nil, model.isLoading {
                stateView(title: "正在加载文章", systemImage: "doc.text")
            } else if selection != nil, let errorMessage = model.errorMessage {
                errorView(errorMessage)
            } else {
                stateView(
                    title: selection == nil ? "未选择文章" : "文章不可用",
                    systemImage: "doc.text"
                )
            }
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .onChange(of: userID, initial: true) { _, newValue in
            model.prepareUser(userID: newValue)
        }
        .overlay {
            if let selectedImageURL {
                ImageZoomOverlay(url: selectedImageURL) {
                    self.selectedImageURL = nil
                }
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.16), value: selectedImageURL)
        .task(id: selection) {
            if let selection {
                await model.open(selection)
            }
        }
    }

    private func reader(_ article: ReaderArticle) -> some View {
        VStack(spacing: 0) {
            header(article, displayTitle: model.titleOverride ?? article.title)
            Divider()
            ArticleActionBar(
                model: model,
                isGuest: selection?.isGuest == true,
                contentWidth: readerContentWidth,
                onContentWidthChange: onReaderContentWidthChange
            ) { action in
                requestAction(action)
            }
            Divider()

            let aiSummary = article.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines)
            let aiStatusPresentation = ReaderAISummaryStatusPresentation(status: article.detail.aiStatus)
            if aiStatusPresentation != nil || !(aiSummary ?? "").isEmpty {
                ReaderAISummaryCard(
                    summary: aiSummary,
                    status: aiStatusPresentation,
                    errorCode: article.detail.aiErrorCode,
                    errorMessage: article.detail.aiErrorMessage,
                    model: article.detail.aiModel,
                    totalTokens: article.detail.aiTotalTokens,
                    canRetry: selection?.isGuest == false && article.detail.aiStatus == "failed",
                    isBusy: model.isPerformingAction,
                    onRetry: {
                        Task { await model.regenerateAI() }
                    }
                )
                Divider()
            }

            if let actionErrorMessage = model.actionErrorMessage {
                Text(actionErrorMessage)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(QiankunjieColors.surfaceVariant(for: colorScheme))
                Divider()
            }

            ReaderWebView(
                html: model.displayHTML,
                contentToken: model.contentToken,
                savedReadingState: model.savedReadingState,
                baseURL: article.originalURL.flatMap(URL.init(string:)),
                displayStyle: ReaderContentStyle(
                    font: appFont,
                    contentWidth: readerContentWidth,
                    colorScheme: colorScheme
                )
            ) { state, contentToken in
                model.updateReadingState(state, contentToken: contentToken)
            } onImageSelected: { url in
                selectedImageURL = url
            }
            .frame(minHeight: 0)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
        .sheet(isPresented: $isCategoryEditorPresented) {
            ReaderCategoryEditorSheet(
                model: model,
                article: article
            ) {
                onLibraryDidChange()
            }
        }
        .confirmationDialog(
            pendingAction?.confirmationTitle ?? "",
            isPresented: Binding(
                get: { pendingAction != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingAction = nil
                    }
                }
            ),
            titleVisibility: .visible,
            presenting: pendingAction
        ) { action in
            let isSoftDelete = action == ReaderArticleAction.delete
            Button {
                perform(action)
            } label: {
                Text(action.buttonTitle)
                    .foregroundStyle(isSoftDelete ? AnyShapeStyle(.orange) : AnyShapeStyle(.primary))
            }
            if isSoftDelete {
                Button(role: .destructive) {
                    pendingAction = nil
                    isPurgeConfirming = true
                } label: {
                    Text("彻底删除").foregroundStyle(.red)
                }
            }
            Button("取消", role: .cancel) {}
        } message: { action in
            Text(action.confirmationMessage)
        }
        .alert("彻底删除这篇文章？", isPresented: $isPurgeConfirming) {
            Button("彻底删除", role: .destructive) {
                Task {
                    await model.deletePermanent()
                    onLibraryDidChange()
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("正文、媒体和元数据会从服务器彻底清除，此操作无法恢复。")
        }
        .overlay {
            if isRenaming {
                renameSheet
            }
        }
    }

    private var renameSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("修改文章标题")
                .font(.headline)
            TextEditor(text: $renameDraft)
                .font(.body)
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(height: 110)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(QiankunjieColors.surface(for: colorScheme))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                }
            HStack {
                Text("\(renameDraft.count)/300")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("取消") {
                    isRenaming = false
                }
                .keyboardShortcut(.cancelAction)
                Button("保存") {
                    Task {
                        await model.rename(title: renameDraft)
                        onLibraryDidChange()
                        isRenaming = false
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(renameDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || renameDraft.count > 300)
            }
        }
        .padding(20)
        .frame(width: 480)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(color: .black.opacity(0.25), radius: 24)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .padding(40)
    }

    private func aiSummaryCard(_ summary: String) -> some View {
        let accent = QiankunjieColors.accent(for: colorScheme)

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(accent)

                Text("AI 摘要")
                    .qiankunjieFont(.labelLarge)
                    .foregroundStyle(accent)
            }

            Text(summary)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(accent.opacity(0.08))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(accent.opacity(0.18))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func header(_ article: ReaderArticle, displayTitle: String?) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(displayTitle ?? article.title ?? "未命名文章")
                        .qiankunjieFont(.headlineSmall)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)

                    if selection?.isGuest == false {
                        HStack(spacing: 2) {
                            Button {
                                renameDraft = displayTitle ?? article.title ?? ""
                                isRenaming = true
                            } label: {
                                Image(systemName: "pencil")
                                    .font(.system(size: 11))
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .help("修改标题")

                            Button {
                                let title = displayTitle ?? article.title ?? ""
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(title, forType: .string)
                                titleCopied = true
                                Task {
                                    try? await Task.sleep(for: .seconds(1.2))
                                    titleCopied = false
                                }
                            } label: {
                                Image(systemName: titleCopied ? "checkmark" : "doc.on.doc")
                                    .font(.system(size: 11))
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .help("复制标题")
                        }
                        .opacity(titleHovered || isRenaming ? 1 : 0)
                    }
                }
                .onHover { titleHovered = $0 || isRenaming }

                HStack(spacing: 8) {
                    Text(article.source ?? "乾坤戒")
                    Text(article.author ?? "未知作者")
                    if let time = article.publishTime ?? article.createdAt {
                        Text(time.formatted(date: .abbreviated, time: .omitted))
                    }
                    Text(statusText(for: article))
                }
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                categoryRow(article)

                HStack(alignment: .top, spacing: 8) {
                    Text("标签")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                    if article.aiTags.isEmpty {
                        Text("无标签")
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    } else {
                        TagFlowLayout(spacing: 6) {
                            ForEach(article.aiTags, id: \.self) { tag in
                                Text(tag)
                                    .qiankunjieFont(.labelMedium)
                                    .lineLimit(1)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2)
                                    .background(QiankunjieColors.surface(for: colorScheme))
                                    .clipShape(Capsule())
                                    .overlay {
                                        Capsule().strokeBorder(QiankunjieColors.outline(for: colorScheme))
                                    }
                            }
                        }
                    }
                }
            }

            Spacer(minLength: 12)

            Button {
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .help("关闭文章")
            .accessibilityLabel("关闭文章")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private func stateView(
        title: String,
        systemImage: String
    ) -> some View {
        ContentUnavailableView(
            title,
            systemImage: systemImage
        )
    }

    private func metadataRow(label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Text(label)
            Text(value)
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .qiankunjieFont(.labelMedium)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
    }

    private func categoryReasonPresentation(for article: ReaderArticle) -> ReaderCategoryReasonPresentation {
        ReaderCategoryReasonPresentation(categoryResult: article.categoryResult)
    }

    @ViewBuilder
    private func categoryRow(_ article: ReaderArticle) -> some View {
        let reasonPresentation = categoryReasonPresentation(for: article)

        HStack(spacing: 8) {
            Text("分类")
            if selection?.isGuest == false && article.isArchived {
                Button {
                    isCategoryEditorPresented = true
                } label: {
                    HStack(spacing: 3) {
                        Text(article.category?.name ?? article.aiCategory ?? "未分类")
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .medium))
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .help("修改分类")
                .accessibilityLabel("修改分类，当前\(article.category?.name ?? article.aiCategory ?? "未分类")")
            } else {
                Text(article.category?.name ?? article.aiCategory ?? "未分类")
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            if reasonPresentation.shouldShowTrigger, let reason = reasonPresentation.reason {
                Button {
                    showCategoryReason.toggle()
                } label: {
                    Image(systemName: "info.circle")
                        .font(.system(size: 12))
                }
                .buttonStyle(.plain)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .accessibilityLabel("查看 AI 分类依据")
                .help("查看 AI 分类依据")
                .popover(isPresented: $showCategoryReason, arrowEdge: .bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("AI 分类依据")
                            .qiankunjieFont(.labelLarge)
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        Text(reason)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                    .padding(12)
                    .frame(maxWidth: 420, alignment: .leading)
                }
            }
        }
        .qiankunjieFont(.labelMedium)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
    }

    private func statusText(for article: ReaderArticle) -> String {
        var statuses: [String] = []
        statuses.append(article.isPublished ? "已公开" : "未公开")
        if article.isFavorited { statuses.append("已收藏") }
        statuses.append(article.isArchived ? "已归档" : "未归档")
        return statuses.joined(separator: " · ")
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
            Text(message)
                .qiankunjieFont(.bodyMedium)
                .multilineTextAlignment(.center)
            Button("重试") {
                guard let selection else {
                    return
                }
                Task {
                    await model.open(selection)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private func requestAction(_ action: ReaderArticleAction) {
        switch action {
        case .favorite:
            perform(action)
        default:
            pendingAction = action
        }
    }

    private func perform(_ action: ReaderArticleAction) {
        pendingAction = nil
        model.onDeleted = onClose

        Task {
            switch action {
            case .favorite:
                await model.toggleFavorite()
            case .archive:
                await model.archive()
            case .inbox:
                await model.moveToInbox()
            case .publish:
                await model.publish()
            case .unpublish:
                await model.unpublish()
            case .refetch:
                await model.refetch()
            case .regenerateAI:
                await model.regenerateAI()
            case .delete:
                await model.delete()
                onLibraryDidChange()
                return
            case .deletePermanent:
                await model.deletePermanent()
                onLibraryDidChange()
                return
            case .openOriginal(let url):
                if ReaderNavigationPolicy.decision(for: url) == .openExternally {
                    NSWorkspace.shared.open(url)
                }
                return
            }

            if model.actionErrorMessage == nil {
                onLibraryDidChange()
            }
        }
    }
}

private struct ReaderCategoryEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let model: ReaderModel
    let article: ReaderArticle
    let onChanged: () -> Void
    @State private var newCategoryName = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if model.isLoadingCategories {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("正在加载分类…")
                                .qiankunjieFont(.labelMedium)
                        }
                        .padding(.vertical, 12)
                    } else if model.availableCategories.isEmpty {
                        Text("暂无可用分类")
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .padding(.vertical, 12)
                    } else {
                        ForEach(model.availableCategories) { category in
                            categoryButton(category)
                        }
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Divider()
            createCategoryForm
        }
        .frame(width: 440, height: 420)
        .background(QiankunjieColors.surface(for: colorScheme))
        .task {
            await model.loadCategories()
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("修改分类")
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Text("选择一个分类；新增后会直接应用到当前文章。")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("关闭分类选择")
        }
        .padding(16)
    }

    private func categoryButton(_ category: ArticleCategory) -> some View {
        let isSelected = category.id == article.category?.id

        return Button {
            Task {
                if await model.moveToCategory(category.id) {
                    onChanged()
                    dismiss()
                }
            }
        } label: {
            HStack(spacing: 9) {
                Circle()
                    .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 9, height: 9)
                Text(category.name)
                    .qiankunjieFont(.bodyMedium)
                Spacer()
                if isSelected {
                    Text("当前")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(QiankunjieColors.surfaceVariant(for: colorScheme).opacity(isSelected ? 1 : 0.45))
            }
        }
        .buttonStyle(.plain)
        .disabled(isSelected || model.isPerformingAction)
        .accessibilityLabel("移动到分类 \(category.name)")
    }

    private var createCategoryForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let message = model.categoryErrorMessage ?? model.actionErrorMessage {
                Text(message)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError)
            }

            HStack(spacing: 8) {
                TextField("新增分类名称", text: $newCategoryName)
                    .textFieldStyle(.roundedBorder)
                    .disabled(model.isCreatingCategory || model.isPerformingAction)

                Button {
                    Task {
                        let name = newCategoryName
                        guard let category = await model.createCategory(name: name) else { return }
                        newCategoryName = ""
                        if await model.moveToCategory(category.id) {
                            onChanged()
                            dismiss()
                        }
                    }
                } label: {
                    if model.isCreatingCategory {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("创建并选择")
                    }
                }
                .disabled(
                    newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        || model.isCreatingCategory
                        || model.isPerformingAction
                )
            }
        }
        .padding(16)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }
}

struct ReaderAISummaryStatusPresentation: Equatable {
    enum Tone: Equatable {
        case pending
        case running
        case failed
        case muted
    }

    let label: String
    let tone: Tone
    let systemImage: String?
    let isRunning: Bool
    let message: String?

    init?(status: String?) {
        switch status {
        case "queued":
            self = .init(label: "排队中", tone: .pending, systemImage: "clock", isRunning: false, message: nil)
        case "running":
            self = .init(label: "生成中", tone: .running, systemImage: nil, isRunning: true, message: nil)
        case "failed":
            self = .init(label: "生成失败", tone: .failed, systemImage: "exclamationmark.circle", isRunning: false, message: nil)
        case "not_configured":
            self = .init(label: "未配置模型", tone: .muted, systemImage: "info.circle", isRunning: false, message: "还没有配置模型，生成已跳过")
        case "disabled":
            self = .init(label: "自动生成已关闭", tone: .muted, systemImage: "pause.circle", isRunning: false, message: "自动生成已关闭")
        default:
            return nil
        }
    }

    private init(label: String, tone: Tone, systemImage: String?, isRunning: Bool, message: String?) {
        self.label = label
        self.tone = tone
        self.systemImage = systemImage
        self.isRunning = isRunning
        self.message = message
    }
}

@MainActor
enum ReaderAISummaryClipboard {
    static func copy(_ summary: String?, to pasteboard: NSPasteboard = .general) -> Bool {
        guard
            let text = summary?.trimmingCharacters(in: .whitespacesAndNewlines),
            !text.isEmpty
        else {
            return false
        }

        pasteboard.clearContents()
        return pasteboard.setString(text, forType: .string)
    }
}

private struct ReaderAISummaryCard: View {
    let summary: String?
    let status: ReaderAISummaryStatusPresentation?
    let errorCode: String?
    let errorMessage: String?
    let model: String?
    let totalTokens: Int?
    let canRetry: Bool
    let isBusy: Bool
    let onRetry: () -> Void
    @State private var isExpanded = true
    @State private var summaryCopied = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let accent = QiankunjieColors.accent(for: colorScheme)

        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Button {
                    toggleExpanded()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(accent)

                        Text("AI 摘要")
                            .qiankunjieFont(.labelLarge)
                            .foregroundStyle(accent)

                        if let status {
                            HStack(spacing: 3) {
                                if status.isRunning {
                                    ProgressView()
                                        .controlSize(.mini)
                                } else if let systemImage = status.systemImage {
                                    Image(systemName: systemImage)
                                        .font(.system(size: 10, weight: .semibold))
                                }
                            }
                            .foregroundStyle(statusColor(status.tone))
                            .help("AI 摘要\(status.label)")
                            .accessibilityLabel("AI 摘要\(status.label)")
                        }

                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isExpanded ? "收起 AI 摘要" : "展开 AI 摘要")

                if let summary, !summary.isEmpty {
                    Button {
                        copySummary(summary)
                    } label: {
                        Image(systemName: summaryCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 11))
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .help("复制 AI 摘要")
                    .accessibilityLabel("复制 AI 摘要")
                }

                Button {
                    toggleExpanded()
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.plain)
                .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    if let summary, !summary.isEmpty {
                        Text(summary)
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    } else if status?.tone == .pending || status?.tone == .running {
                        ReaderAISummaryPlaceholder()
                    } else if let statusMessage = status?.message {
                        Text(statusMessage)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }

                    if
                        status?.tone == .failed,
                        let errorMessage,
                        !errorMessage.isEmpty
                    {
                        Text(errorCode.map { "\($0)：\(errorMessage)" } ?? errorMessage)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(
                                colorScheme == .dark
                                    ? QiankunjieColors.darkError
                                    : QiankunjieColors.lightError
                            )
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if model != nil || totalTokens != nil || canRetry {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            if let model {
                                Text("模型：\(model)")
                            }
                            if let totalTokens {
                                Text("Token：\(totalTokens.formatted())")
                            }
                            Spacer(minLength: 0)
                            if canRetry {
                                Button("重试", action: onRetry)
                                    .disabled(isBusy)
                            }
                        }
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
        }
        .background {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(accent.opacity(0.08))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(accent.opacity(0.18))
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func toggleExpanded() {
        withAnimation(.easeOut(duration: 0.18)) {
            isExpanded.toggle()
        }
    }

    private func copySummary(_ summary: String) {
        guard ReaderAISummaryClipboard.copy(summary) else { return }
        summaryCopied = true
        Task {
            try? await Task.sleep(for: .seconds(1.2))
            summaryCopied = false
        }
    }

    private func statusColor(_ tone: ReaderAISummaryStatusPresentation.Tone) -> Color {
        switch tone {
        case .pending, .running:
            QiankunjieColors.accent(for: colorScheme)
        case .failed:
            colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError
        case .muted:
            QiankunjieColors.onSurfaceVariant(for: colorScheme)
        }
    }
}

private struct ReaderAISummaryPlaceholder: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            placeholder(width: 132)
            placeholder(width: 186)
            placeholder(width: 96)
        }
    }

    private func placeholder(width: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(QiankunjieColors.onSurfaceVariant(for: colorScheme).opacity(0.14))
            .frame(width: width, height: 10)
    }
}

private extension Color {
    init?(hexString: String?) {
        guard let hexString else { return nil }
        let cleaned = hexString.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else {
            return nil
        }
        self.init(hex: value)
    }
}

private struct ImageZoomOverlay: View {
    let url: URL
    let onClose: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.opacity(0.86)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                default:
                    VStack(spacing: 10) {
                        ProgressView()
                            .controlSize(.large)
                        Text("正在加载图片")
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(32)

            Button {
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(colorScheme == .dark ? .white : .black)
                    .frame(width: 30, height: 30)
                    .background(.white.opacity(0.9), in: Circle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.cancelAction)
            .padding(18)
            .help("关闭图片预览")
        }
    }
}
