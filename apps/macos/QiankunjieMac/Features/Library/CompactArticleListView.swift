import AppKit
import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

extension ArticleCard {
    var searchSectionNames: String {
        var names: [String] = []

        if isPublished || publicID != nil {
            names.append("已发布")
        }
        if isArchived {
            names.append("归档")
        }
        if isFavorited {
            names.append("收藏")
        }
        if !isArchived && !isFavorited {
            names.append("收件箱")
        }

        return names.joined(separator: " · ")
    }
}

private struct ContextBulkActionRequest: Identifiable {
    let action: BulkToolbarAction
    let targetArticleID: Int?

    var id: String {
        "\(action)-\(targetArticleID.map(String.init) ?? "bulk")"
    }
}

struct CompactArticleListView: View {
    @Bindable var model: LibraryModel
    @Binding var selection: Int?
    @Binding var presentationMode: ArticleListPresentationMode
    @Environment(\.colorScheme) private var colorScheme
    @State private var contextBulkAction: ContextBulkActionRequest?
    @State private var contextBulkCategoryRequest: BulkCategoryRequest?
    @State private var contextObsidianArticleID: Int?
    @State private var isContextObsidianSheetPresented = false
    @State private var resultToast: String?

    private let paginationPreviewCount = 6
    private let layoutMetrics = CompactArticleListLayoutMetrics()

    var body: some View {
        VStack(spacing: 0) {
            LibraryToolbar(
                model: model,
                presentationMode: $presentationMode,
                onCopyOriginalLinks: {
                    copyOriginalLinks(selectedArticles())
                }
            )
            Rectangle()
                .fill(QiankunjieColors.outline(for: colorScheme))
                .frame(height: 1)
            content
                .statusToast(message: $resultToast)
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .onChange(of: model.bulkResult) { _, result in
            guard let result else { return }
            // 成功（含跳过）用弱提醒；有失败/异常时保留结果，交给下面的弹窗。
            guard result.issues.isEmpty else { return }
            resultToast = successSummary(result)
            model.clearBulkResult()
        }
        .alert(
            "操作失败",
            isPresented: Binding(
                get: { model.bulkResult?.issues.isEmpty == false },
                set: { isPresented in
                    if !isPresented {
                        model.clearBulkResult()
                    }
                }
            )
        ) {
            Button("关闭", role: .cancel) {
                model.clearBulkResult()
            }
        } message: {
            Text(failureMessage)
        }
        .confirmationDialog(
            contextBulkAction.map {
                BulkToolbarPolicy.confirmation(
                    for: $0.action,
                    selectedCount: contextSelectedCount(for: $0)
                ).title
            } ?? "确认操作",
            isPresented: Binding(
                get: { contextBulkAction != nil },
                set: { isPresented in
                    if !isPresented { contextBulkAction = nil }
                }
            ),
            presenting: contextBulkAction
        ) { request in
            let copy = BulkToolbarPolicy.confirmation(
                for: request.action,
                selectedCount: contextSelectedCount(for: request)
            )
            Button(copy.confirmTitle, role: copy.isDestructive ? .destructive : nil) {
                contextBulkAction = nil
                Task {
                    if let articleID = request.targetArticleID {
                        await model.runArticleToolbarAction(request.action, articleID: articleID)
                    } else {
                        await model.runBulkToolbarAction(request.action)
                    }
                }
            }
            Button("取消", role: .cancel) {}
        } message: { request in
            Text(BulkToolbarPolicy.confirmation(
                for: request.action,
                selectedCount: contextSelectedCount(for: request)
            ).message)
        }
        .sheet(item: $contextBulkCategoryRequest) { request in
            BulkCategorySelectionSheet(model: model, request: request)
        }
        .sheet(isPresented: $isContextObsidianSheetPresented) {
            ObsidianExportSheet(
                initialDraft: .lastUsed(
                    articleTitle: "批量导出",
                    settingsStore: ObsidianExportSettingsStore()
                ),
                onCancel: {
                    isContextObsidianSheetPresented = false
                },
                onConfirm: { draft in
                    isContextObsidianSheetPresented = false
                    saveLastUsedSelection(draft)
                    let targetArticleID = contextObsidianArticleID
                    contextObsidianArticleID = nil
                    Task {
                        if let targetArticleID {
                            await model.runArticleToolbarAction(
                                .bulkObsidian,
                                articleID: targetArticleID,
                                obsidianDestination: draft.directoryURL
                            )
                        } else {
                            await model.runBulkToolbarAction(
                                .bulkObsidian,
                                obsidianDestination: draft.directoryURL
                            )
                        }
                    }
                },
                showsTitle: false,
                subtitle: "已选 \(model.bulkSelection.count) 篇文章"
            )
        }
    }

    private var content: some View {
        Group {
            switch model.displayState {
            case .loading:
                loadingView
            case .empty:
                emptyView
            case .error:
                errorView
            case .content:
                articleList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// 成功结果的弱提醒文案（不需要用户确认）。
    private func successSummary(_ result: NativeBulkResult) -> String {
        var parts = ["成功 \(result.succeededCount) 篇"]
        if result.skippedCount > 0 {
            parts.append("跳过 \(result.skippedCount) 篇")
        }
        if let exportURL = model.bulkExportURL {
            parts.append("已保存到 \(exportURL.lastPathComponent)")
        }
        return parts.joined(separator: " · ")
    }

    /// 失败/异常的详细文案（弹窗里展示，需要用户自行关闭）。
    private var failureMessage: String {
        guard let result = model.bulkResult else { return "" }

        var lines = [
            "成功 \(result.succeededCount) 篇 · 跳过 \(result.skippedCount) 篇 · 失败 \(result.issues.count) 篇"
        ]
        for issue in result.issues {
            let message = issue.message ?? "未知原因"
            lines.append("ID \(issue.articleID)：\(issue.code) · \(message)")
        }
        if let exportURL = model.bulkExportURL {
            lines.append("已保存：\(exportURL.path)")
        }
        return lines.joined(separator: "\n")
    }

    private func hasOriginalLink(_ article: ArticleCard) -> Bool {
        article.originalURL?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    /// 当前批量选择里的文章（按列表顺序）。
    private func selectedArticles() -> [ArticleCard] {
        model.articles.filter { model.bulkSelection.contains($0.id) }
    }

    /// 复制一或多篇文章的原文链接（多条按行拼接），并用弱提醒反馈。
    private func copyOriginalLinks(_ articles: [ArticleCard]) {
        let links = articles
            .compactMap { $0.originalURL?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !links.isEmpty else { return }

        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(links.joined(separator: "\n"), forType: .string)
        resultToast = links.count == 1 ? "已复制原文链接" : "已复制 \(links.count) 条原文链接"
    }

    @ViewBuilder
    private func contextMenuButton(
        _ action: BulkToolbarAction,
        targetArticleID: Int?
    ) -> some View {
        Button(BulkToolbarPolicy.menuTitle(for: action)) {
            switch action {
            case .archive:
                contextBulkCategoryRequest = BulkCategoryRequest(
                    purpose: .archive,
                    targetArticleID: targetArticleID
                )
            case .setCategory:
                contextBulkCategoryRequest = BulkCategoryRequest(
                    purpose: .setCategory,
                    targetArticleID: targetArticleID
                )
            case .bulkObsidian:
                contextObsidianArticleID = targetArticleID
                isContextObsidianSheetPresented = true
            default:
                contextBulkAction = ContextBulkActionRequest(
                    action: action,
                    targetArticleID: targetArticleID
                )
            }
        }
    }

    private var articleList: some View {
        ThinScrollView {
            LazyVStack(spacing: 8) {
                ForEach(
                    Array(model.articles.enumerated()),
                    id: \.element.id
                ) { index, article in
                    Group {
                        if presentationMode == .card {
                            articleCard(article)
                        } else {
                            articleRow(article)
                        }
                    }
                    .contextMenu {
                        let operatesOnCurrentSelection = model.isBulkSelecting
                            && !model.bulkSelection.isEmpty
                            && model.bulkSelection.contains(article.id)
                        let targetArticleID = operatesOnCurrentSelection ? nil : article.id

                        Button(
                            operatesOnCurrentSelection
                                ? "复制选中文章原文链接"
                                : "复制原文链接"
                        ) {
                            copyOriginalLinks(
                                operatesOnCurrentSelection ? selectedArticles() : [article]
                            )
                        }
                        .disabled(
                            operatesOnCurrentSelection
                                ? selectedArticles().isEmpty
                                : !hasOriginalLink(article)
                        )

                        ForEach(
                            BulkArticlePolicy.actionGroups(for: model.view),
                            id: \.self
                        ) { group in
                            Divider()

                            ForEach(
                                BulkArticlePolicy.actions(in: group, for: model.view),
                                id: \.self
                            ) { action in
                                contextMenuButton(action, targetArticleID: targetArticleID)
                            }
                        }
                    }
                    .onAppear {
                        if index >= model.articles.count - paginationPreviewCount {
                            Task {
                                await model.loadMore()
                            }
                        }
                    }
                }

                if model.isLoadingMore {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在加载更多")
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .padding(.vertical, 8)
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 8)
            .padding(.vertical, 10)
        }
        .task(id: model.articles.map(\.id)) {
            ArticleCoverImageCache.shared.prefetch(
                model.articles.compactMap { article in
                    article.coverImage.flatMap(URL.init(string:))
                }
            )
        }
    }

    private func articleRow(_ article: ArticleCard) -> some View {
        let isSelected = model.isBulkSelecting
            ? model.bulkSelection.contains(article.id)
            : selection == article.id

        return Button {
            if model.isBulkSelecting {
                model.toggleBulkSelection(article.id)
            } else {
                selection = article.id
            }
        } label: {
            HStack(alignment: .center, spacing: 10) {
                rowCover(article)

                VStack(alignment: .leading, spacing: 5) {
                    Text(article.title ?? "未命名文章")
                        .qiankunjieFont(.titleMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)

                    Text(article.aiSummary ?? "暂无摘要")
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .lineLimit(2)

                    aiStatusBadge(article)

                    HStack(spacing: 8) {
                        if model.isSearching {
                            Label(
                                article.searchSectionNames,
                                systemImage: "square.stack.3d.up"
                            )
                        }

                        Label(
                            article.source ?? "未知来源",
                            systemImage: Self.sourceSystemImage(article.source)
                        )
                        if let time = displayTime(article) {
                            Label(time, systemImage: "clock")
                        }
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)

                    tags(article)
                }

                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(minHeight: layoutMetrics.rowHeight, alignment: .center)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background {
            GlassSurface(role: .control, cornerRadius: QiankunjieRadius.control) {
                Color.clear
            }
        }
        .overlay {
            if isSelected {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(
                        QiankunjieColors.accent(for: colorScheme),
                        lineWidth: 1.5
                    )
            }
        }
    }

    private func articleCard(_ article: ArticleCard) -> some View {
        let isSelected = model.isBulkSelecting
            ? model.bulkSelection.contains(article.id)
            : selection == article.id

        return Button {
            if model.isBulkSelecting {
                model.toggleBulkSelection(article.id)
            } else {
                selection = article.id
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                cardCover(article)

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        if model.isSearching {
                            Label(
                                article.searchSectionNames,
                                systemImage: "square.stack.3d.up"
                            )
                        }

                        Label(
                            article.source ?? "未知来源",
                            systemImage: Self.sourceSystemImage(article.source)
                        )

                        if let time = displayTime(article) {
                            Label(time, systemImage: "clock")
                        }
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)

                    Text(article.title ?? "未命名文章")
                        .font(.headline)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    if let summary = article.aiSummary, !summary.isEmpty {
                        Text(summary)
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    aiStatusBadge(article)

                    tags(article)
                }
                .padding(14)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background {
            GlassSurface(role: .control, cornerRadius: QiankunjieRadius.panel) {
                Color.clear
            }
        }
        .overlay {
            if isSelected {
                RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                    .strokeBorder(
                        QiankunjieColors.accent(for: colorScheme),
                        lineWidth: 1.5
                    )
            }
            if model.isBulkSelecting {
                bulkSelectionIndicator(article)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(10)
            }
        }
    }

    private func bulkSelectionIndicator(_ article: ArticleCard) -> some View {
        let isSelected = model.bulkSelection.contains(article.id)

        return Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 20, weight: .medium))
            .foregroundStyle(
                isSelected
                    ? QiankunjieColors.accent(for: colorScheme)
                    : QiankunjieColors.onSurfaceVariant(for: colorScheme)
            )
    }

    private func cover(_ article: ArticleCard) -> some View {
        coverImage(article)
            .frame(
                width: layoutMetrics.rowCoverSize,
                height: layoutMetrics.rowCoverSize
            )
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .accessibilityLabel("文章封面")
    }

    private func rowCover(_ article: ArticleCard) -> some View {
        coverImage(article)
            .frame(
                width: layoutMetrics.rowCoverSize,
                height: layoutMetrics.rowCoverSize
            )
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous))
            .overlay(alignment: .topLeading) {
                if model.isBulkSelecting {
                    bulkSelectionIndicator(article)
                        .padding(8)
                }
            }
            .accessibilityLabel("文章封面")
    }

    private func cardCover(_ article: ArticleCard) -> some View {
        Color.clear
            .aspectRatio(layoutMetrics.cardCoverAspectRatio, contentMode: .fit)
            .overlay {
                coverImage(article)
            }
            .clipped()
            .clipShape(
                // 卡片上方两个角要和下方的面板圆角保持一致，否则封面会把圆角盖成直角。
                UnevenRoundedRectangle(
                    topLeadingRadius: QiankunjieRadius.panel,
                    bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: QiankunjieRadius.panel,
                    style: .continuous
                )
            )
            .accessibilityLabel("文章封面")
    }

    @ViewBuilder
    private func aiStatusBadge(_ article: ArticleCard) -> some View {
        if article.aiStatus != nil {
            Text(aiStatusText(article.aiStatus))
                .qiankunjieFont(.labelMedium)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(QiankunjieColors.surface(for: colorScheme))
                .clipShape(Capsule())
                .overlay {
                    Capsule().strokeBorder(QiankunjieColors.outline(for: colorScheme))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func coverImage(_ article: ArticleCard) -> some View {
        ZStack {
            if
                let coverText = article.coverImage,
                let url = URL(string: coverText)
            {
                ArticleCoverImageView(url: url) {
                    fallbackCover(article)
                }
            } else {
                fallbackCover(article)
            }
    }
}

@MainActor
final class ArticleCoverImageCache {
    static let shared = ArticleCoverImageCache()

    private let cache = NSCache<NSURL, NSImage>()
    private var loadingTasks: [URL: Task<NSImage?, Never>] = [:]

    private init() {
        cache.countLimit = 400
    }

    func storedImage(for url: URL) -> NSImage? {
        cache.object(forKey: url as NSURL)
    }

    func prefetch(_ urls: [URL]) {
        for url in urls where storedImage(for: url) == nil {
            Task {
                await image(for: url)
            }
        }
    }

    func image(for url: URL) async -> NSImage? {
        if let cachedImage = storedImage(for: url) {
            return cachedImage
        }

        if let loadingTask = loadingTasks[url] {
            return await loadingTask.value
        }

        let loadingTask = Task {
            let image = await load(url)
            loadingTasks.removeValue(forKey: url)
            return image
        }
        loadingTasks[url] = loadingTask

        return await loadingTask.value
    }

    private func load(_ url: URL) async -> NSImage? {
        if let cachedImage = storedImage(for: url) {
            return cachedImage
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard
                let httpResponse = response as? HTTPURLResponse,
                200..<300 ~= httpResponse.statusCode,
                let image = NSImage(data: data)
            else {
                return nil
            }

            cache.setObject(image, forKey: url as NSURL)
            return image
        } catch {
            if !Task.isCancelled {
                print("Article cover load failed:", error.localizedDescription)
            }
            return nil
        }
    }
}

private struct ArticleCoverImageView<Fallback: View>: View {
    let url: URL
    @ViewBuilder let fallback: () -> Fallback

    @State private var image: NSImage?
    @State private var didFail = false

    var body: some View {
        Group {
            if let cachedImage = ArticleCoverImageCache.shared.storedImage(for: url) {
                imageView(cachedImage)
            } else if let image {
                imageView(image)
            } else {
                fallback()
            }
        }
        .task(id: url) {
            if ArticleCoverImageCache.shared.storedImage(for: url) != nil {
                return
            }

            let loadedImage = await ArticleCoverImageCache.shared.image(for: url)
            if !Task.isCancelled, let loadedImage {
                image = loadedImage
            } else if !Task.isCancelled {
                didFail = true
            }
        }
    }

    private func imageView(_ image: NSImage) -> some View {
        Image(nsImage: image)
            .resizable()
            .scaledToFill()
    }
}

    private func fallbackCover(_ article: ArticleCard) -> some View {
        let palette = ArticleCoverFallback.forArticle(article.id)

        return ZStack {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(palette.gradient)
            BrandAssetName.qiankunjieMark.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .padding(12)
                .opacity(0.82)
        }
    }

    private func tags(_ article: ArticleCard) -> some View {
        HorizontalTagScrollView {
            ForEach(layoutMetrics.visibleTags(article.aiTags)) { tag in
                tagCapsule(tag.text)
            }
        }
    }

    private func tagCapsule(_ text: String) -> some View {
        Text(text)
            .qiankunjieFont(.labelMedium)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(QiankunjieColors.surface(for: colorScheme))
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
    }

    private var loadingView: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("正在加载文章")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            let asset = colorScheme == .dark
                ? BrandAssetName.emptyLibraryDark
                : BrandAssetName.emptyLibraryLight

            asset.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 96, height: 96)
            Text("资料库为空")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        }
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
            Text(model.errorMessage ?? "加载资料库失败")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .multilineTextAlignment(.center)
            Button {
                Task {
                    await model.retry()
                }
            } label: {
                Label("重试", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private func contextSelectedCount(for request: ContextBulkActionRequest) -> Int {
        request.targetArticleID == nil ? model.bulkSelection.count : 1
    }

    private func saveLastUsedSelection(_ draft: ObsidianExportDraft) {
        guard
            let vaultURL = draft.vaultURL,
            let directoryURL = draft.directoryURL
        else {
            return
        }

        let store = ObsidianExportSettingsStore()
        store.save(
            ObsidianExportSettings(
                directoryURL: directoryURL,
                conflictPolicy: store.load().conflictPolicy
            ),
            vaultURL: vaultURL
        )
    }

    private func displayTime(_ article: ArticleCard) -> String? {
        article.publishTime?.formatted(.relative(presentation: .named))
            ?? article.createdAt?.formatted(.relative(presentation: .named))
    }

    private struct HorizontalTagScrollView<Content: View>: View {
        @ViewBuilder let content: Content
        @State private var dragOffset: CGFloat = 0
        @State private var availableWidth: CGFloat = 0
        @State private var contentWidth: CGFloat = 0

        init(@ViewBuilder content: () -> Content) {
            self.content = content()
        }

        var body: some View {
            GeometryReader { proxy in
                HStack(spacing: 5) {
                    content
                }
                .fixedSize(horizontal: true, vertical: false)
                .padding(.vertical, 1)
                .background {
                    GeometryReader { contentProxy in
                        Color.clear
                            .onAppear { contentWidth = contentProxy.size.width }
                            .onChange(of: contentProxy.size.width) { _, width in
                                contentWidth = width
                            }
                    }
                }
                .offset(x: self.clampedOffset(0, availableWidth: proxy.size.width))
                .gesture(
                    DragGesture(minimumDistance: 1)
                        .onChanged { value in
                        dragOffset = self.clampedOffset(
                                dragOffset + value.translation.width,
                                availableWidth: proxy.size.width
                            )
                        }
                )
                .onAppear { availableWidth = proxy.size.width }
                .onChange(of: proxy.size.width) { _, width in
                    availableWidth = width
                dragOffset = self.clampedOffset(dragOffset, availableWidth: width)
                }
            }
            .frame(height: 30)
            .clipped()
        }

        private func clampedOffset(
            _ offset: CGFloat,
            availableWidth: CGFloat
        ) -> CGFloat {
            let overflow = max(0, contentWidth - availableWidth)
            return min(0, max(-overflow, offset))
        }
    }

    static func sourceSystemImage(_ source: String?) -> String {
        // 覆盖「微信」转发导入与「微信公众号」网页采集两类来源。
        source?.contains("微信") == true ? "person.2" : "doc.text"
}

}
