import AppKit
import QiankunjieReader
import SwiftUI
import UniformTypeIdentifiers

enum ArticleExportAction: String, CaseIterable, Identifiable, Sendable {
    case markdown
    case html
    case pdf
    case word
    case plainText
    case epub
    case obsidian
    case copyMarkdown
    case copyPlainText

    var id: String { rawValue }

    var title: String {
        switch self {
        case .markdown: "Markdown"
        case .html: "HTML"
        case .pdf: "PDF"
        case .word: "Word"
        case .plainText: "纯文本"
        case .epub: "EPUB"
        case .obsidian: "Obsidian"
        case .copyMarkdown: "复制 Markdown"
        case .copyPlainText: "复制纯文本"
        }
    }

    var systemImage: String {
        switch self {
        case .markdown: "doc.plaintext"
        case .html: "chevron.left.forwardslash.chevron.right"
        case .pdf: "doc.richtext"
        case .word: "doc.text"
        case .plainText: "text.alignleft"
        case .epub: "book"
        case .obsidian: "arrow.up.right.square"
        case .copyMarkdown: "doc.on.doc"
        case .copyPlainText: "doc.on.clipboard"
        }
    }

    var format: ArticleExportFormat? {
        switch self {
        case .markdown: .markdown
        case .html: .html
        case .pdf: .pdf
        case .word: .word
        case .plainText: .plainText
        case .epub: .epub
        case .obsidian, .copyMarkdown, .copyPlainText: nil
        }
    }
}

struct ArticleExportAlert: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let openURL: URL?

    static func success(_ url: URL) -> Self {
        Self(
            title: "导出完成",
            detail: "文件已保存到：\n\(url.path)",
            openURL: url
        )
    }

    static func error(_ message: String) -> Self {
        Self(
            title: "导出失败",
            detail: message,
            openURL: nil
        )
    }
}

struct ArticleExportMenu: View {
    let article: ReaderArticle
    @State private var alert: ArticleExportAlert?
    @State private var obsidianDraft: ObsidianExportDraft?
    @State private var isExporting = false

    private let notificationService = ArticleExportNotificationService()

    var body: some View {
        Menu {
            Section("文件") {
                ForEach([ArticleExportAction.markdown, .html, .pdf, .word, .plainText, .epub]) { action in
                    Button {
                        perform(action)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                }
            }

            Section("笔记") {
                Button {
                    prepareObsidianExport()
                } label: {
                    Label(ArticleExportAction.obsidian.title, systemImage: ArticleExportAction.obsidian.systemImage)
                }
            }

            Section("复制") {
                Button {
                    perform(.copyMarkdown)
                } label: {
                    Label(ArticleExportAction.copyMarkdown.title, systemImage: ArticleExportAction.copyMarkdown.systemImage)
                }
                Button {
                    perform(.copyPlainText)
                } label: {
                    Label(ArticleExportAction.copyPlainText.title, systemImage: ArticleExportAction.copyPlainText.systemImage)
                }
            }
        } label: {
            if isExporting {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: "square.and.arrow.up")
            }
        }
        .menuStyle(.borderlessButton)
        .help("导出文章")
        .accessibilityLabel("导出文章")
        .disabled(isExporting)
        .alert(item: $alert) { alert in
            if let openURL = alert.openURL {
                return Alert(
                    title: Text(alert.title),
                    message: Text(alert.detail),
                    primaryButton: .default(Text("立即打开")) {
                        NSWorkspace.shared.open(openURL)
                    },
                    secondaryButton: .cancel(Text("取消"))
                )
            }

            return Alert(
                title: Text(alert.title),
                message: Text(alert.detail),
                dismissButton: .default(Text("好"))
            )
        }
        .sheet(item: $obsidianDraft) { draft in
            ObsidianExportSheet(
                initialDraft: draft,
                onCancel: {
                    obsidianDraft = nil
                },
                onConfirm: { confirmedDraft in
                    obsidianDraft = nil
                    exportToObsidian(confirmedDraft)
                }
            )
        }
    }

    private func perform(_ action: ArticleExportAction) {
        isExporting = true
        Task { @MainActor in
            defer { isExporting = false }
            do {
                let completion = try await ArticleExportCoordinator().perform(action, article: article)
                if let completion {
                    await handle(completion)
                }
            } catch is CancellationError {
                return
            } catch {
                alert = .error(error.localizedDescription)
            }
        }
    }

    private func prepareObsidianExport() {
        let store = ObsidianExportSettingsStore()
        obsidianDraft = .lastUsed(articleTitle: article.title, settingsStore: store)
    }

    private func exportToObsidian(_ draft: ObsidianExportDraft) {
        isExporting = true
        Task { @MainActor in
            defer { isExporting = false }
            do {
                let completion = try await ArticleExportCoordinator()
                    .exportToObsidian(draft, article: article)
                await handle(completion)
            } catch is CancellationError {
                return
            } catch {
                alert = .error(error.localizedDescription)
            }
        }
    }

    private func handle(_ completion: ArticleExportCompletion) async {
        switch completion.presentation {
        case .openPrompt(let url):
            alert = .success(url)
        case .notification(_, let body):
            await notificationService.notifyCopySuccess(body)
        }
    }
}

@MainActor
final class ArticleExportCoordinator {
    private let settingsStore = ObsidianExportSettingsStore()

    func perform(
        _ action: ArticleExportAction,
        article: ReaderArticle
    ) async throws -> ArticleExportCompletion? {
        let document = makeDocument(from: article)
        switch action {
        case .obsidian:
            return nil
        case .copyMarkdown:
            copyToPasteboard(MarkdownArticleRenderer().render(document))
            return .copied(
                title: "复制成功",
                body: "Markdown 已复制到剪贴板"
            )
        case .copyPlainText:
            copyToPasteboard(PlainTextArticleRenderer().render(document))
            return .copied(
                title: "复制成功",
                body: "纯文本已复制到剪贴板"
            )
        default:
            guard let format = action.format else { return nil }
            let url = try await exportToFile(document, format: format)
            return .file(url)
        }
    }

    private func makeDocument(from article: ReaderArticle) -> ArticleExportDocument {
        ArticleExportDocument(
            title: article.title,
            author: article.author,
            source: article.source,
            originalURL: article.originalURL,
            publishedAt: formatDate(article.publishTime),
            savedAt: formatDate(article.createdAt),
            aiSummary: article.aiSummary,
            category: article.category?.name ?? article.aiCategory,
            tags: article.aiTags,
            contentMarkdown: article.contentMarkdown,
            contentHTML: article.contentHTML
        )
    }

    private func exportToFile(
        _ document: ArticleExportDocument,
        format: ArticleExportFormat
    ) async throws -> URL {
        let panel = NSSavePanel()
        panel.canCreateDirectories = true
        panel.nameFieldStringValue = "\(safeExportFileName(document.title)).\(format.fileExtension)"
        panel.allowedContentTypes = [UTType(filenameExtension: format.fileExtension) ?? .data]
        guard panel.runModal() == .OK, let url = panel.url else {
            throw CancellationError()
        }

        switch format {
        case .markdown:
            try MarkdownArticleRenderer().render(document).data(using: .utf8)?.write(to: url, options: .atomic)
        case .html:
            try HTMLArticleRenderer().render(document).data(using: .utf8)?.write(to: url, options: .atomic)
        case .plainText:
            try PlainTextArticleRenderer().render(document).data(using: .utf8)?.write(to: url, options: .atomic)
        case .pdf:
            try await PDFArticleRenderer().render(document, to: url)
        case .word:
            try await DocxArticleRenderer().render(document, to: url)
        case .epub:
            try await EPUBArticleRenderer().render(document, to: url)
        }
        return url
    }

    func exportToObsidian(
        _ draft: ObsidianExportDraft,
        article: ReaderArticle
    ) async throws -> ArticleExportCompletion {
        guard draft.vaultURL != nil else {
            throw ObsidianExportError.notConfigured
        }

        guard let directoryURL = draft.directoryURL else {
            throw ObsidianExportError.notConfigured
        }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: directoryURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            throw ObsidianExportError.directoryUnavailable
        }

        let settings = ObsidianExportSettings(
            directoryURL: directoryURL,
            conflictPolicy: settingsStore.load().conflictPolicy
        )
        settingsStore.save(settings, vaultURL: draft.vaultURL)
        let document = draft.resolvedDocument(from: makeDocument(from: article))
        let url = try ObsidianArticleExporter(settings: settings).export(document)
        return .file(url)
    }

    private func copyToPasteboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func formatDate(_ date: Date?) -> String? {
        guard let date else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }
}

struct ObsidianExportSheet: View {
    let onCancel: () -> Void
    let onConfirm: (ObsidianExportDraft) -> Void
    var showsTitle = true
    var subtitle: String?

    @State private var draft: ObsidianExportDraft
    @State private var errorMessage: String?
    @State private var vaults: [ObsidianVault] = []
    @State private var selectedVaultID: String?
    @State private var directoryIndex: ObsidianDirectoryIndex?
    @State private var isLoadingDirectories = false
    @State private var isPathPickerPresented = false
    @State private var pathSearch = ""
    @State private var favoriteDirectoryPaths: [String] = []
    @State private var draggedFavoritePath: String?
    @State private var hoveredDirectoryPath: String?

    private let favoriteDirectoriesStore: ObsidianFavoriteDirectoriesStore

    init(
        initialDraft: ObsidianExportDraft,
        onCancel: @escaping () -> Void,
        onConfirm: @escaping (ObsidianExportDraft) -> Void,
        showsTitle: Bool = true,
        subtitle: String? = nil
    ) {
        _draft = State(initialValue: initialDraft)
        self.onCancel = onCancel
        self.onConfirm = onConfirm
        self.showsTitle = showsTitle
        self.subtitle = subtitle
        self.favoriteDirectoriesStore = ObsidianFavoriteDirectoriesStore()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("导出到 Obsidian")
                .font(.title2.weight(.semibold))

            if let subtitle {
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Form {
                if showsTitle {
                    TextField("标题", text: $draft.title, axis: .vertical)
                        .lineLimit(2...4)
                        .fixedSize(horizontal: false, vertical: true)
                }

                LabeledContent("保管库") {
                    vaultMenu
                }

                LabeledContent("路径") {
                    pathMenu
                }
            }
            .formStyle(.grouped)

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.callout)
            }

            HStack {
                Spacer()
                Button("取消", role: .cancel) {
                    onCancel()
                }
                Button("导出") {
                    confirm()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(22)
        .frame(width: 560)
        .onAppear {
            loadVaults()
        }
    }

    private var vaultMenu: some View {
        HStack(spacing: 4) {
            Spacer(minLength: 0)
            Picker("保管库", selection: vaultSelection) {
                if vaults.isEmpty {
                    Text("未发现 Obsidian 保管库")
                        .tag(nil as String?)
                } else {
                    ForEach(vaults) { vault in
                        Text(vault.name)
                            .tag(vault.id as String?)
                    }
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)

            Button {
                chooseCustomVault()
            } label: {
                Image(systemName: "folder.badge.plus")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.borderless)
            .help("选择其他保管库")
            .accessibilityLabel("选择其他保管库")
        }
    }

    private var vaultSelection: Binding<String?> {
        Binding(
            get: { selectedVaultID },
            set: { newValue in
                guard
                    let newValue,
                    let vault = vaults.first(where: { $0.id == newValue })
                else {
                    return
                }
                selectVault(vault)
            }
        )
    }


    private var pathMenu: some View {
        Button {
            isPathPickerPresented.toggle()
        } label: {
            HStack(spacing: 8) {
                Text(draft.relativeDirectoryPath)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 8)
                Image(systemName: isPathPickerPresented ? "chevron.up" : "chevron.down")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(nsColor: .controlBackgroundColor))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color(nsColor: .separatorColor).opacity(0.65))
            }
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(draft.vaultURL == nil)
        .popover(isPresented: $isPathPickerPresented, arrowEdge: .bottom) {
            pathPicker
        }
    }

    private var pathPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("搜索目录", text: $pathSearch)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.quaternary)
            }

            Divider()

            if isLoadingDirectories {
                ProgressView("正在读取目录…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let directoryIndex {
                let items = directoryIndex.items(matching: pathSearch)
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        if pathSearch.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            favoriteDirectorySection
                            Divider()
                                .padding(.vertical, 6)
                        }

                        if items.isEmpty {
                            Text("没有匹配的目录")
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 24)
                        } else {
                            ForEach(items) { item in
                                allDirectoryRow(item)
                            }
                        }
                    }
                }
            } else {
                Text("请先选择 Obsidian 保管库")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding(12)
        .frame(width: 420, height: 440)
    }

    private var favoriteDirectorySection: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("常用目录")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("最多 \(ObsidianFavoriteDirectoriesStore.maximumCount) 个")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 3)

            if favoriteDirectoryItems.isEmpty {
                Text(favoriteDirectoryPaths.isEmpty
                    ? "点击目录右侧的图钉，可固定为常用目录。"
                    : "已固定的目录当前不可用。"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            } else {
                ForEach(favoriteDirectoryItems) { item in
                    favoriteDirectoryRow(item)
                }
            }
        }
    }

    private var favoriteDirectoryItems: [ObsidianDirectoryItem] {
        guard let directoryIndex else { return [] }
        return favoriteDirectoryPaths.compactMap { directoryIndex.item(relativePath: $0) }
    }

    private func favoriteDirectoryRow(_ item: ObsidianDirectoryItem) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "line.3.horizontal")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .frame(width: 12, height: 20)
                .help("拖动排序")
                .onDrag {
                    draggedFavoritePath = item.relativePath
                    return NSItemProvider(object: item.relativePath as NSString)
                }

            Image(systemName: item.relativePath.isEmpty ? "folder.fill" : "folder")
                .foregroundStyle(.secondary)

            Button {
                selectDirectory(item)
            } label: {
                Text(item.name)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(QiankunjiePlainButtonStyle())

            ObsidianPinButton(
                isPinned: true,
                isAtLimit: false,
                itemName: item.name,
                isProminent: true
            ) {
                toggleFavorite(item.relativePath)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background {
            if isSelected(item) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.accentColor.opacity(0.16))
            }
        }
        .contentShape(Rectangle())
        .onDrop(
            of: [UTType.text],
            delegate: ObsidianFavoriteDirectoryDropDelegate(
                targetPath: item.relativePath,
                draggedPath: $draggedFavoritePath,
                onMove: moveFavoriteBefore
            )
        )
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    private func allDirectoryRow(_ item: ObsidianDirectoryItem) -> some View {
        let isPinned = favoriteDirectoryPaths.contains(item.relativePath)
        let isHovered = hoveredDirectoryPath == item.relativePath
        let isAtLimit = !isPinned && favoriteDirectoryPaths.count >= ObsidianFavoriteDirectoriesStore.maximumCount

        return HStack(spacing: 7) {
            Color.clear
                .frame(width: CGFloat(item.depth) * 14, height: 1)
            Image(systemName: item.relativePath.isEmpty ? "folder.fill" : "folder")
                .foregroundStyle(.secondary)

            Button {
                selectDirectory(item)
            } label: {
                HStack(spacing: 8) {
                    Text(item.name)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    if isSelected(item) {
                        Image(systemName: "checkmark")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(QiankunjiePlainButtonStyle())

            ObsidianPinButton(
                isPinned: isPinned,
                isAtLimit: isAtLimit,
                itemName: item.name,
                isProminent: isHovered
            ) {
                toggleFavorite(item.relativePath)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background {
            if isSelected(item) || isHovered {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.accentColor.opacity(isSelected(item) ? 0.16 : 0.08))
            }
        }
        .onHover { hovering in
            if hovering {
                hoveredDirectoryPath = item.relativePath
            } else if hoveredDirectoryPath == item.relativePath {
                hoveredDirectoryPath = nil
            }
        }
    }

    private func loadVaults() {
        do {
            var discoveredVaults = try ObsidianVaultRegistry().discover()
            if let currentURL = draft.vaultURL,
               !discoveredVaults.contains(where: { $0.url.standardizedFileURL.path == currentURL.standardizedFileURL.path }) {
                let url = currentURL.standardizedFileURL
                discoveredVaults.insert(
                    ObsidianVault(
                        id: url.path,
                        name: url.lastPathComponent.isEmpty ? url.path : url.lastPathComponent,
                        url: url,
                        isOpen: true
                    ),
                    at: 0
                )
            }
            vaults = discoveredVaults

            if let currentURL = draft.vaultURL {
                selectedVaultID = currentURL.standardizedFileURL.path
                favoriteDirectoryPaths = favoriteDirectoriesStore.load(forVaultURL: currentURL)
                loadDirectoryIndex(for: currentURL)
            } else if let firstVault = discoveredVaults.first {
                selectVault(firstVault)
            }
        } catch {
            errorMessage = "读取 Obsidian 配置失败：\(error.localizedDescription)"
        }
    }

    private func selectVault(_ vault: ObsidianVault) {
        selectedVaultID = vault.id
        draft.vaultURL = vault.url.standardizedFileURL
        draft.destinationURL = nil
        pathSearch = ""
        draggedFavoritePath = nil
        hoveredDirectoryPath = nil
        favoriteDirectoryPaths = favoriteDirectoriesStore.load(forVaultURL: vault.url)
        errorMessage = nil
        loadDirectoryIndex(for: vault.url)
    }

    private func chooseCustomVault() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = false
        panel.allowsMultipleSelection = false
        panel.prompt = "选择其他保管库"
        guard panel.runModal() == .OK, let vaultURL = panel.url else { return }

        let url = vaultURL.standardizedFileURL
        let vault = ObsidianVault(
            id: url.path,
            name: url.lastPathComponent.isEmpty ? url.path : url.lastPathComponent,
            url: url,
            isOpen: true
        )
        if !vaults.contains(where: { $0.id == vault.id }) {
            vaults.insert(vault, at: 0)
        }
        selectVault(vault)
    }

    private func loadDirectoryIndex(for vaultURL: URL) {
        let url = vaultURL.standardizedFileURL
        directoryIndex = nil
        isLoadingDirectories = true
        errorMessage = nil

        Task {
            do {
                let index = try await Task.detached(priority: .userInitiated) {
                    try ObsidianDirectoryIndex(vaultURL: url)
                }.value
                guard draft.vaultURL?.standardizedFileURL.path == url.path else { return }
                directoryIndex = index
                isLoadingDirectories = false
            } catch {
                guard draft.vaultURL?.standardizedFileURL.path == url.path else { return }
                directoryIndex = nil
                isLoadingDirectories = false
                errorMessage = "读取目录失败：\(error.localizedDescription)"
            }
        }
    }

    private func selectDirectory(_ item: ObsidianDirectoryItem) {
        guard let vaultURL = draft.vaultURL else { return }
        draft.destinationURL = item.relativePath.isEmpty
            ? nil
            : vaultURL.appendingPathComponent(item.relativePath, isDirectory: true).standardizedFileURL
        isPathPickerPresented = false
        pathSearch = ""
        draggedFavoritePath = nil
        hoveredDirectoryPath = nil
    }

    private func toggleFavorite(_ relativePath: String) {
        guard let vaultURL = draft.vaultURL else { return }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) {
            favoriteDirectoryPaths = favoriteDirectoriesStore.toggle(relativePath, forVaultURL: vaultURL)
        }
    }

    private func moveFavoriteBefore(_ sourcePath: String, _ targetPath: String) {
        guard let vaultURL = draft.vaultURL else { return }
        favoriteDirectoryPaths = favoriteDirectoriesStore.move(
            sourcePath,
            before: targetPath,
            forVaultURL: vaultURL
        )
    }

    private func isSelected(_ item: ObsidianDirectoryItem) -> Bool {
        if item.relativePath.isEmpty {
            return draft.destinationURL == nil
        }
        guard let vaultURL = draft.vaultURL, let destinationURL = draft.destinationURL else {
            return false
        }
        let candidate = vaultURL
            .appendingPathComponent(item.relativePath, isDirectory: true)
            .standardizedFileURL
            .path
        return destinationURL.standardizedFileURL.path == candidate
    }

    private func confirm() {
        guard draft.vaultURL != nil else {
            errorMessage = "请选择 Obsidian 保管库。"
            return
        }
        guard !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "标题不能为空。"
            return
        }
        onConfirm(draft)
    }

}

private struct ObsidianPinButton: View {
    let isPinned: Bool
    let isAtLimit: Bool
    let itemName: String
    let isProminent: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isPinned ? "pin.fill" : "pin")
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: isPinned)
                .rotationEffect(.degrees(isPinned ? 24 : -18))
                .scaleEffect(isPinned ? 1.08 : 0.92)
                .foregroundStyle(isPinned ? .primary : .secondary)
                .opacity(isPinned || isProminent ? 1 : 0.32)
                .frame(width: 18, height: 18)
                .animation(.spring(response: 0.3, dampingFraction: 0.58), value: isPinned)
        }
        .buttonStyle(.borderless)
        .disabled(isAtLimit)
        .help(isPinned ? "取消固定" : isAtLimit ? "最多固定 6 个常用目录" : "固定到常用目录")
        .accessibilityLabel(
            isPinned
                ? "取消固定 \(itemName)"
                : isAtLimit ? "最多固定 6 个常用目录" : "固定 \(itemName) 到常用目录"
        )
    }
}

private struct ObsidianFavoriteDirectoryDropDelegate: DropDelegate {
    let targetPath: String
    @Binding var draggedPath: String?
    let onMove: (String, String) -> Void

    func dropEntered(info: DropInfo) {
        guard let draggedPath, draggedPath != targetPath else { return }
        onMove(draggedPath, targetPath)
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        draggedPath = nil
        return true
    }
}
