import QiankunjieAuth
import QiankunjieDesignSystem
import QiankunjieCollect
import QiankunjieCore
import QiankunjieLibrary
import SwiftUI

struct RootWindow: View {
    @Bindable var model: AppModel
    @Binding var menuBarController: MenuBarController?
    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorScheme) private var colorScheme
    @State private var sidebarVisibility: NavigationSplitViewVisibility = .all
    @State private var isSidebarCollapsed = false
    @State private var availableWidth: CGFloat = 1200
    private let layoutPolicy = AppShellLayoutPolicy()
    private let columnWidthPolicy = AppShellColumnWidthPolicy()

    var body: some View {
        mainInterface
            .preferredColorScheme(
                model.settingsModel.appearance.resolvedColorScheme(system: colorScheme)
            )
            .overlay {
                if model.isLoginPresented {
                    LoginOverlay(
                        authModel: model.authModel,
                        onAuthenticated: model.didAuthenticate,
                        onCancel: model.dismissLogin
                    )
                    .transition(.opacity)
                }
            }
    }

    private var mainInterface: some View {
        Group {
            if model.isSearchPresented {
                searchShell
            } else {
                shell
            }
        }
        .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
            } action: { newValue in
                availableWidth = newValue
            }
            .dynamicTypeSize(model.settingsModel.appFont.dynamicTypeSize)
            .qiankunjieAppFontScale(model.settingsModel.appFont.uiScale)
            .background(QiankunjieColors.background(for: colorScheme))
            .environment(\.font, QiankunjieTypography.font(.bodyMedium, scale: model.settingsModel.appFont.uiScale))
            .toolbar {
                rootToolbar
            }
            .onAppear {
                installMenuBarIfNeeded()
            }
    }

    private var layout: AppShellLayout {
        layoutPolicy.layout(
            availableWidth: availableWidth,
            selectedArticleID: model.selectedArticleID,
            destination: model.destination
        )
    }

    private var contentColumnWidth: (minimum: CGFloat, ideal: CGFloat) {
        columnWidthPolicy.contentColumnWidth(availableWidth: availableWidth)
    }

    @ViewBuilder
    private var shell: some View {
        Group {
            switch layout {
            case .threeColumns:
                HStack(spacing: 0) {
                    if isSidebarCollapsed {
                        collapsedSidebarRail
                    }

                    threeColumnShell
                }
            case .settings:
                HStack(spacing: 0) {
                    if isSidebarCollapsed {
                        collapsedSidebarRail
                    }

                    settingsShell
                }
            case .listDetail:
                listDetailShell
            }
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .onChange(of: sidebarVisibility) { _, newValue in
            isSidebarCollapsed = newValue == .detailOnly
        }
    }

    private var collapsedSidebarRail: some View {
        SidebarView(
            model: model,
            destinationSelection: destinationSelection,
            isCollapsed: true
        )
        .frame(width: 68)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private var threeColumnShell: some View {
        NavigationSplitView(columnVisibility: $sidebarVisibility) {
            SidebarView(
                model: model,
                destinationSelection: destinationSelection,
                isCollapsed: false
            )
                .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } content: {
            listColumn
                .navigationSplitViewColumnWidth(
                    min: contentColumnWidth.minimum,
                    ideal: contentColumnWidth.ideal,
                    max: .infinity
                )
        } detail: {
            readerPane
        }
        .navigationSplitViewStyle(.automatic)
    }

    private var listDetailShell: some View {
        NavigationSplitView {
            listColumn
        } detail: {
            readerPane
        }
        .navigationSplitViewStyle(.automatic)
    }

    private var settingsShell: some View {
        NavigationSplitView(columnVisibility: $sidebarVisibility) {
            SidebarView(
                model: model,
                destinationSelection: destinationSelection,
                isCollapsed: false
            )
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } detail: {
            Group {
                if model.destination == .admin {
                    AdminSettingsView(repository: model.authModel.repository)
                } else {
                    SettingsView(
                        model: model,
                        menuBarController: menuBarController,
                        onLogin: model.presentLogin
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .tint(WorkspacePalette.primary(for: colorScheme))
        }
        .navigationSplitViewStyle(.automatic)
    }

    private var searchShell: some View {
        HStack(spacing: 0) {
            SearchWorkspaceView(
                model: model.searchModel,
                selection: articleSelection,
                onSelect: model.selectSearchArticle,
                onClose: model.closeSearch
            )
            .frame(width: searchResultWidth)

            Divider()

            readerPane
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var searchResultWidth: CGFloat {
        min(max(360, availableWidth * 0.36), 520)
    }

    private var showsMainSidebar: Bool {
        if case .listDetail = layout {
            return false
        }

        return true
    }

    @ViewBuilder
    private var listColumn: some View {
        if model.destination.requiresAuthentication, !model.isAuthenticated {
            GuestAccessView(
                title: "登录后查看\(model.destination.title)",
                message: "当前账号未登录，登录后即可查看\(model.destination.title)内容。"
            ) {
                model.presentLogin()
            }
        } else if let libraryView = model.destination.libraryView {
            CompactArticleListView(
                model: model.libraryModel,
                selection: articleSelection,
                presentationMode: presentationModeBinding
            )
            .id(libraryView)
        } else if model.destination == .collect {
            CollectView(
                model: model.collectModel,
                onOpenArticle: model.openCollectArticle
            )
        } else {
            LibraryPlaceholderView(destination: model.destination)
        }
    }

    private var articleSelection: Binding<Int?> {
        Binding(
            get: { model.selectedArticleID },
            set: { model.selectArticle($0) }
        )
    }

    @AppStorage("library.articlePresentation") private var articlePresentationRawValue = ArticleListPresentationMode.compactList.rawValue

    private var presentationModeBinding: Binding<ArticleListPresentationMode> {
        Binding(
            get: {
                ArticleListPresentationMode(rawValue: articlePresentationRawValue) ?? .compactList
            },
            set: { articlePresentationRawValue = $0.rawValue }
        )
    }

    private var readerPane: some View {
        ReaderPaneView(
            selection: model.selectedReaderSelection,
            userID: model.user?.id,
            appFont: model.settingsModel.appFont,
            readerContentWidth: model.settingsModel.readerContentWidth,
            onReaderContentWidthChange: {
                model.settingsModel.setReaderContentWidth($0)
            },
            positionStore: model.readerPositionStore,
            networkClient: model.readerAPIClient,
            onClose: {
                model.closeArticle()
            },
            onLibraryDidChange: {
                Task {
                    await model.libraryModel.load(reset: true)
                }
            }
        )
    }

    @ToolbarContentBuilder
    private var rootToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button {
                model.toggleSearch()
            } label: {
                Label("搜索", systemImage: model.isSearchPresented ? "magnifyingglass.circle.fill" : "magnifyingglass")
            }
            .help(model.isSearchPresented ? "关闭搜索" : "搜索资料库")
        }
    }

    private func installMenuBarIfNeeded() {
        guard menuBarController == nil else { return }

        let controller = MenuBarController(
            appModel: model,
            shortcut: model.shortcutSettings.shortcut,
            onShowMainWindow: {
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
        )
        controller.start()
        menuBarController = controller
    }

    private var destinationSelection: Binding<AppDestination> {
        Binding(
            get: { model.destination },
            set: { model.selectDestination($0) }
        )
    }
}

private struct SearchWorkspaceView: View {
    @Bindable var model: LibraryModel
    let selection: Binding<Int?>
    let onSelect: @MainActor (ArticleCard) -> Void
    let onClose: @MainActor () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 0) {
            searchHeader

            Rectangle()
                .fill(QiankunjieColors.outline(for: colorScheme))
                .frame(height: 1)

            content
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button {
                    onClose()
                } label: {
                    Label("返回", systemImage: "chevron.left")
                }
            }
        }
    }

    private var searchHeader: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                TextField("搜索标题、来源、摘要或标签", text: $model.searchDraft)
                    .textFieldStyle(.plain)
                    .onSubmit(submit)
                    .accessibilityLabel("搜索关键词")

                if !model.searchDraft.isEmpty {
                    Button {
                        clear()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("清除搜索")
                }

                Button(action: submit) {
                    Image(systemName: "arrowtriangle.right.fill")
                }
                .buttonStyle(.borderless)
                .disabled(model.searchDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .help("搜索")
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(QiankunjieColors.surface(for: colorScheme))
            .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    @ViewBuilder
    private var content: some View {
        if model.appliedSearchText.isEmpty {
            SearchStateView(
                title: "搜索资料库",
                systemImage: "magnifyingglass",
                message: "输入关键词后按回车搜索标题、来源、摘要、分类或标签。"
            )
        } else if model.isLoading {
            VStack(spacing: 10) {
                ProgressView()
                Text("正在搜索")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage = model.errorMessage {
            SearchStateView(
                title: "搜索失败",
                systemImage: "exclamationmark.triangle",
                message: errorMessage
            )
        } else if model.articles.isEmpty {
            SearchStateView(
                title: "没有匹配的文章",
                systemImage: "doc.text.magnifyingglass",
                message: "试试更短的关键词，或检查拼写后重新搜索。"
            )
        } else {
            VStack(spacing: 0) {
                resultStatusBar

                Rectangle()
                    .fill(QiankunjieColors.outline(for: colorScheme))
                    .frame(height: 1)

                resultList
            }
        }
    }

    private var resultStatusBar: some View {
        HStack {
            Text(model.appliedSearchText.isEmpty ? "" : "搜索“\(model.appliedSearchText)”")
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer(minLength: 12)

            if model.total > 0 {
                Text("共 \(model.total) 篇")
                    .monospacedDigit()
            }
        }
        .qiankunjieFont(.labelMedium)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private var resultList: some View {
        ThinScrollView {
            LazyVStack(spacing: 8) {
                ForEach(model.articles, id: \.id) { article in
                    SearchResultRow(
                        article: article,
                        isSelected: selection.wrappedValue == article.id,
                        onSelect: {
                            onSelect(article)
                        }
                    )
                }

                if model.canLoadMore {
                    Button {
                        Task {
                            await model.loadMore()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            if model.isLoadingMore {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Image(systemName: "chevron.down.circle")
                            }
                            Text(model.isLoadingMore ? "正在加载" : "加载更多")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.isLoadingMore)
                }

                if model.isLoadingMore, !model.canLoadMore {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
    }

    private func submit() {
        model.submitSearch()
        Task {
            await model.load(reset: true)
        }
    }

    private func clear() {
        model.clearSearch()
        selection.wrappedValue = nil
    }
}

private struct SearchResultRow: View {
    let article: ArticleCard
    let isSelected: Bool
    let onSelect: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: 10) {
                SearchResultCoverView(article: article)

                VStack(alignment: .leading, spacing: 6) {
                    Text(article.title ?? "未命名文章")
                        .qiankunjieFont(.titleMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(article.aiSummary ?? article.originalURL ?? "暂无摘要")
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 8) {
                        Label(article.source ?? "未知来源", systemImage: "doc.text")
                        if let date = article.createdAt ?? article.publishTime {
                            Label(date.formatted(.relative(presentation: .named)), systemImage: "clock")
                        }
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)
                }

                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .fill(isSelected ? QiankunjieColors.accent(for: colorScheme).opacity(0.12) : QiankunjieColors.surface(for: colorScheme))
        }
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .strokeBorder(
                    isSelected ? QiankunjieColors.accent(for: colorScheme) : QiankunjieColors.outline(for: colorScheme)
                )
        }
    }
}

private struct SearchResultCoverView: View {
    let article: ArticleCard

    var body: some View {
        ZStack {
            if
                let coverText = article.coverImage,
                let url = URL(string: coverText)
            {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .accessibilityLabel("文章封面")
    }

    private var fallback: some View {
        let palette = ArticleCoverFallback.forArticle(article.id)

        return ZStack {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(palette.gradient)

            BrandAssetName.qiankunjieMark.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .padding(10)
                .opacity(0.82)
        }
    }
}

private struct SearchStateView: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(message)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
    }
}

private struct GuestAccessView: View {
    let title: String
    let message: String
    let onLogin: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.badge.key")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)

            VStack(spacing: 8) {
                Text(title)
                    .font(.title3.weight(.semibold))

                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("登录", action: onLogin)
                .buttonStyle(.borderedProminent)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QiankunjieColors.background(for: colorScheme))
    }
}

private struct LoginOverlay: View {
    let authModel: AuthModel
    let onAuthenticated: @MainActor () -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.black.opacity(0.46))
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onCancel)

            LoginView(
                authModel: authModel,
                onAuthenticated: onAuthenticated,
                onCancel: onCancel
            )
            .onTapGesture {}
        }
        .transition(.opacity)
    }
}

private struct LibraryPlaceholderView: View {
    let destination: AppDestination

    var body: some View {
        ContentUnavailableView(
            "暂无内容",
            systemImage: "list.bullet.rectangle",
            description: Text(destination.title)
        )
    }
}
