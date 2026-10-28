import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

enum LibraryCategoryMenuState: Equatable, Sendable {
    case loading
    case empty
    case failure
    case ready

    var message: String? {
        switch self {
        case .loading: "正在加载分类…"
        case .empty: "暂无启用分类"
        case .failure: "分类加载失败，重新加载"
        case .ready: nil
        }
    }
}

enum LibraryCategoryMenuPolicy {
    static func state(
        isLoading: Bool,
        errorMessage: String?,
        activeCategoryCount: Int
    ) -> LibraryCategoryMenuState {
        if isLoading {
            return .loading
        }
        if activeCategoryCount > 0 {
            return .ready
        }
        if errorMessage != nil {
            return .failure
        }
        return .empty
    }
}

struct LibraryToolbar: View {
    @Bindable var model: LibraryModel
    @Bindable var categoryCatalog: CategoryCatalogModel
    let selectedCategoryID: Int?
    let onSelectCategory: (Int?) -> Void
    @Binding var presentationMode: ArticleListPresentationMode
    /// 复制当前批量选择里所有文章的原文链接。
    var onCopyOriginalLinks: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme
    @State private var isRefreshButtonHovered = false
    @State private var pendingBulkAction: BulkToolbarAction?
    @State private var bulkCategoryRequest: BulkCategoryRequest?
    @State private var isBulkObsidianSheetPresented = false

    var body: some View {
        Group {
            if model.isSearching {
                searchResultsHeader
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    header
                    controls
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
        .confirmationDialog(
            pendingBulkConfirmation?.title ?? "确认批量操作",
            isPresented: isBulkActionDialogPresented,
            presenting: pendingBulkAction
        ) { action in
            Button(
                BulkToolbarPolicy.confirmation(for: action, selectedCount: model.bulkSelection.count).confirmTitle,
                role: BulkToolbarPolicy.confirmation(for: action, selectedCount: model.bulkSelection.count).isDestructive ? .destructive : nil
            ) {
                if action == .bulkObsidian {
                    pendingBulkAction = nil
                    isBulkObsidianSheetPresented = true
                } else {
                    runBulkToolbarAction(action)
                }
            }
            Button("取消", role: .cancel) {}
        } message: { _ in
            Text(pendingBulkConfirmation?.message ?? "")
        }
        .sheet(item: $bulkCategoryRequest) { request in
            BulkCategorySelectionSheet(
                model: model,
                catalog: categoryCatalog,
                request: request
            )
        }
        .sheet(isPresented: $isBulkObsidianSheetPresented) {
            ObsidianExportSheet(
                initialDraft: .lastUsed(
                    articleTitle: "批量导出",
                    settingsStore: ObsidianExportSettingsStore()
                ),
                onCancel: {
                    isBulkObsidianSheetPresented = false
                },
                onConfirm: { draft in
                    isBulkObsidianSheetPresented = false
                    saveLastUsedSelection(draft)
                    runBulkToolbarAction(
                        .bulkObsidian,
                        obsidianDestination: draft.directoryURL
                    )
                },
                showsTitle: false,
                subtitle: "已选 \(model.bulkSelection.count) 篇文章"
            )
        }
    }

    private var searchResultsHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))

            VStack(alignment: .leading, spacing: 2) {
                Text("搜索结果")
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                Text("“\(model.appliedSearchText)” · 全部资料库")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)
            }

            Spacer(minLength: 12)

            if model.isLoading || model.isRefreshing {
                ProgressView()
                    .controlSize(.small)
            }

            Button {
                model.clearSearch()
                reload()
            } label: {
                Label("清除", systemImage: "xmark.circle.fill")
                    .font(.system(size: 12, weight: .medium))
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .help("清除搜索")
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private var isBulkActionDialogPresented: Binding<Bool> {
        Binding(
            get: { pendingBulkAction != nil },
            set: { isPresented in
                if !isPresented {
                    pendingBulkAction = nil
                }
            }
        )
    }

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.view.title)
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                subtitle
            }
            .layoutPriority(1)

            Spacer(minLength: 12)

            if model.isBulkSelecting {
                bulkControls
            } else {
                bulkEntryButton

                presentationModeButton

                refreshButton
            }
        }
    }

    private var subtitle: some View {
        HStack(spacing: 8) {
            if let count = model.count(for: model.view) {
                Text("共 \(count) 篇")
            }
            if model.isShowingCache {
                Label("离线缓存", systemImage: "wifi.slash")
            }
            if let errorMessage = model.loadMoreErrorMessage {
                Text(errorMessage)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            }
        }
        .qiankunjieFont(.labelMedium)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        .lineLimit(1)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 8) {
            if model.isSourceFilterAvailable {
                HStack(spacing: 8) {
                    sortPicker
                    orderButton
                    sourcePicker
                    categoryPicker
                }
            } else {
                HStack(spacing: 8) {
                    sortPicker
                    orderButton
                }
            }

            if model.isSourceFilterAvailable, model.availableSources.isEmpty, let message = model.sourceErrorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle")
                    Text(message)
                        .lineLimit(1)
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
            }
        }
    }

    private var controlSurface: some View {
        RoundedRectangle(cornerRadius: QiankunjieRadius.control)
            .fill(QiankunjieColors.surface(for: colorScheme))
            .overlay {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
    }

    private var presentationModeButton: some View {
        HStack(spacing: 2) {
            ForEach(ArticleListPresentationMode.allCases) { mode in
                presentationModeSelectionButton(mode)
            }
        }
        .background { controlSurface }
        .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control))
        .help("切换文章列表样式")
    }

    private func presentationModeSelectionButton(_ mode: ArticleListPresentationMode) -> some View {
        let isSelected = presentationMode == mode

        return Button {
            presentationMode = mode
        } label: {
            Image(systemName: mode.systemImage)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(
                    isSelected
                        ? QiankunjieColors.accent(for: colorScheme)
                        : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                )
                .frame(width: 27, height: 24)
                .background {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isSelected ? QiankunjieColors.accent(for: colorScheme).opacity(0.14) : .clear)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .accessibilityLabel("\(mode.title)样式")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .help("切换到\(mode.title)样式")
    }

    private var sortPicker: some View {
        Menu {
            ForEach(model.availableSorts, id: \.self) { sort in
                Button(sort.title) {
                    model.selectSort(sort)
                    reload()
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.system(size: 11, weight: .medium))
                Text(model.sort.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .frame(width: 104, height: 28)
            .padding(.horizontal, 7)
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(!model.appliedSearchText.isEmpty)
        .background { controlSurface }
        .help("选择排序")
    }

    private var orderButton: some View {
        Button {
            model.toggleOrder()
            reload()
        } label: {
            LibrarySortOrderIcon(ascending: model.order == .asc)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(!model.appliedSearchText.isEmpty)
        .background { controlSurface }
        .help(model.order == .asc ? "当前升序" : "当前降序")
    }

    private var sourcePicker: some View {
        Menu {
            Button("全部来源") {
                model.selectSource(nil)
                reload()
            }
            ForEach(model.availableSources) { source in
                Button("\(source.source)（\(source.count)）") {
                    model.selectSource(source.source)
                    reload()
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "tray.full")
                    .font(.system(size: 11, weight: .medium))
                Text(model.source ?? "全部来源")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .frame(maxWidth: 128, alignment: .leading)
            .frame(height: 28)
            .padding(.horizontal, 7)
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(QiankunjiePlainButtonStyle())
        .background { controlSurface }
        .help("选择来源")
    }

    private var categoryPicker: some View {
        Menu {
            Button("全部文章") {
                onSelectCategory(nil)
            }

            Divider()

            switch categoryMenuState {
            case .loading, .empty:
                Button(categoryMenuState.message ?? "") {}
                    .disabled(true)
            case .failure:
                Button("分类加载失败，重新加载") {
                    Task {
                        await categoryCatalog.load()
                    }
                }
            case .ready:
                ForEach(categoryCatalog.activeCategories) { category in
                    Button("\(category.name)（\(categoryCatalog.count(for: category.id))）") {
                        onSelectCategory(category.id)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "folder")
                    .font(.system(size: 11, weight: .medium))
                Text(selectedCategoryName)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .frame(maxWidth: 128, alignment: .leading)
            .frame(height: 28)
            .padding(.horizontal, 7)
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .menuIndicator(.visible)
        .buttonStyle(QiankunjiePlainButtonStyle())
        .background { controlSurface }
        .help("选择分类")
    }

    private var categoryMenuState: LibraryCategoryMenuState {
        LibraryCategoryMenuPolicy.state(
            isLoading: categoryCatalog.isLoading,
            errorMessage: categoryCatalog.errorMessage,
            activeCategoryCount: categoryCatalog.activeCategories.count
        )
    }

    private var selectedCategoryName: String {
        guard let selectedCategoryID,
              let category = categoryCatalog.activeCategories.first(where: {
                  $0.id == selectedCategoryID
              })
        else {
            return "全部文章"
        }
        return category.name
    }

    private var refreshButton: some View {
        Button {
            guard !model.isRefreshing else { return }

            reload(reset: false)
        } label: {
            ZStack {
                if model.isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                        .scaleEffect(isRefreshButtonHovered ? 1.08 : 1)
                        .foregroundStyle(
                            isRefreshButtonHovered
                                ? QiankunjieColors.accent(for: colorScheme)
                                : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
            }
            .frame(width: 28, height: 28)
            .background {
                if isRefreshButtonHovered {
                    RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                        .fill(QiankunjieColors.accent(for: colorScheme).opacity(0.12))
                        .overlay {
                            RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                                .strokeBorder(
                                    QiankunjieColors.accent(for: colorScheme).opacity(0.32)
                                )
                        }
                } else {
                    controlSurface
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(model.isRefreshing)
        .onHover { isHovered in
            guard isHovered != isRefreshButtonHovered else { return }

            isRefreshButtonHovered = isHovered
        }
        .animation(.easeOut(duration: 0.16), value: isRefreshButtonHovered)
        .background { controlSurface }
        .help("刷新资料库")
    }

    private var bulkEntryButton: some View {
        Button {
            model.toggleBulkMode()
        } label: {
            bulkButtonLabel("批量操作", systemImage: "checklist")
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(model.articles.isEmpty)
        .help("进入批量操作")
    }

    private var bulkControls: some View {
        HStack(spacing: 8) {
            Text("已选 \(model.bulkSelection.count) 篇")
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

            Button {
                model.selectAllLoadedForBulk()
            } label: {
                Text("全选")
                    .qiankunjieFont(.labelMedium)
                    .padding(.horizontal, 9)
                    .frame(height: 28)
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .disabled(model.articles.isEmpty || model.bulkRunningAction != nil)
            .background { controlSurface }

            Button {
                model.invertBulkSelection()
            } label: {
                Text("反选")
                    .qiankunjieFont(.labelMedium)
                    .padding(.horizontal, 9)
                    .frame(height: 28)
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .disabled(model.articles.isEmpty || model.bulkRunningAction != nil)
            .background { controlSurface }

            bulkActionMenu

            exitBulkButton
        }
    }

    private var bulkActionMenu: some View {
        Menu {
            Button("复制选中文章原文链接") {
                onCopyOriginalLinks()
            }
            .disabled(model.bulkSelection.isEmpty)

            Divider()

            ForEach(BulkArticlePolicy.actionGroups(for: model.view), id: \.self) { group in
                if group != BulkArticlePolicy.actionGroups(for: model.view).first {
                    Divider()
                }

                ForEach(BulkArticlePolicy.actions(in: group, for: model.view), id: \.self) { action in
                    Button(actionTitle(action)) {
                        switch action {
                        case .archive:
                            bulkCategoryRequest = BulkCategoryRequest(purpose: .archive, targetArticleID: nil)
                        case .setCategory:
                            bulkCategoryRequest = BulkCategoryRequest(purpose: .setCategory, targetArticleID: nil)
                        default:
                            pendingBulkAction = action
                        }
                    }
                }
            }
        } label: {
            bulkButtonLabel("批量操作", systemImage: "chevron.up.chevron.down")
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(model.bulkSelection.isEmpty || model.bulkRunningAction != nil)
        .help("选择批量操作")
    }

    private var exitBulkButton: some View {
        Button {
            model.toggleBulkMode()
        } label: {
            bulkButtonLabel("退出", systemImage: "xmark")
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(!BulkToolbarPolicy.canExit(bulkRunningAction: model.bulkRunningAction))
        .help("退出批量操作")
    }

    private func bulkButtonLabel(_ title: String, systemImage: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .medium))
            Text(title)
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

    private var pendingBulkConfirmation: BulkConfirmationCopy? {
        pendingBulkAction.map {
            BulkToolbarPolicy.confirmation(for: $0, selectedCount: model.bulkSelection.count)
        }
    }

    private func actionTitle(_ action: BulkToolbarAction) -> String {
        BulkToolbarPolicy.menuTitle(for: action)
    }

    private func runBulkToolbarAction(
        _ action: BulkToolbarAction,
        obsidianDestination: URL? = nil
    ) {
        pendingBulkAction = nil
        Task {
            await model.runBulkToolbarAction(
                action,
                obsidianDestination: obsidianDestination
            )
        }
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

    private func reload(reset: Bool = true) {
        Task {
            await model.load(reset: reset)
        }
    }
}

private extension LibraryView {
    var title: String {
        switch self {
        case .inbox: "收件箱"
        case .favorites: "收藏"
        case .archive: "归档"
        case .published: "已发布"
        }
    }
}

private extension ArticleSort {
    var title: String {
        switch self {
        case .collected: "最新收录"
        case .published: "最新发布"
        case .favorited: "最近收藏"
        case .archived: "最近归档"
        }
    }
}

private struct LibrarySortOrderIcon: View {
    let ascending: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 1.5) {
            Image(systemName: ascending ? "arrow.up" : "arrow.down")
                .resizable()
                .scaledToFit()
                .frame(width: 8, height: 18)

            VStack(spacing: 0) {
                Text(ascending ? "A" : "Z")
                Text(ascending ? "Z" : "A")
            }
            .font(.system(size: 8, weight: .semibold, design: .rounded))
                .lineSpacing(-1)
                .frame(height: 18, alignment: .center)
        }
    }
}
