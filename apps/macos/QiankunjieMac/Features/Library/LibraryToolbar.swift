import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct LibraryToolbar: View {
    @Bindable var model: LibraryModel
    @Binding var presentationMode: ArticleListPresentationMode
    @Environment(\.colorScheme) private var colorScheme
    @State private var pendingBulkAction: BulkToolbarAction?
    @State private var pendingBulkCategory: LibraryCategoryFilter?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            controls
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
                runBulkToolbarAction(action)
            }
            Button("取消", role: .cancel) {}
        } message: { _ in
            Text(pendingBulkConfirmation?.message ?? "")
        }
        .confirmationDialog(
            categoryConfirmation?.title ?? "设置分类",
            isPresented: isBulkCategoryDialogPresented,
            presenting: pendingBulkCategory
        ) { category in
            Button("设置分类") {
                runBulkCategory(category)
            }
            Button("取消", role: .cancel) {}
        } message: { _ in
            Text(categoryConfirmation?.message ?? "")
        }
        .alert(
            "批量操作结果",
            isPresented: isBulkResultAlertPresented
        ) {
            Button("完成", role: .cancel) {
                model.clearBulkResult()
            }
        } message: {
            Text(resultMessage)
        }
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

    private var isBulkCategoryDialogPresented: Binding<Bool> {
        Binding(
            get: { pendingBulkCategory != nil },
            set: { isPresented in
                if !isPresented {
                    pendingBulkCategory = nil
                }
            }
        )
    }

    private var isBulkResultAlertPresented: Binding<Bool> {
        Binding(
            get: { model.bulkResult != nil },
            set: { isPresented in
                if !isPresented {
                    model.clearBulkResult()
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

                searchField
                    .frame(minWidth: 88, maxWidth: 240)
                    .layoutPriority(-1)

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
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
        .background { controlSurface }
        .help("选择来源")
    }

    private var categoryPicker: some View {
        Menu {
            Button("全部文章") {
                model.selectCategory(nil)
                reload()
            }
            ForEach(model.availableCategories) { filter in
                Button("\(filter.name)（\(filter.count)）") {
                    model.selectCategory(filter.id)
                    reload()
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "folder")
                    .font(.system(size: 11, weight: .medium))
                Text(model.selectedCategory?.name ?? "全部文章")
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
        .buttonStyle(.plain)
        .background { controlSurface }
        .help("选择分类")
    }

    private var refreshButton: some View {
        Button {
            reload(reset: false)
        } label: {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 12, weight: .medium))
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background { controlSurface }
        .help("刷新资料库")
    }

    private var bulkEntryButton: some View {
        Button {
            model.toggleBulkMode()
        } label: {
            bulkButtonLabel("批量操作", systemImage: "checklist")
        }
        .buttonStyle(.plain)
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
            .buttonStyle(.plain)
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
            .buttonStyle(.plain)
            .disabled(model.articles.isEmpty || model.bulkRunningAction != nil)
            .background { controlSurface }

            bulkActionMenu

            exitBulkButton
        }
    }

    private var bulkActionMenu: some View {
        Menu {
            ForEach(BulkArticlePolicy.toolbarActions(for: model.view), id: \.self) { action in
                if action == .setCategory {
                    Menu("设置分类") {
                        ForEach(model.availableCategories) { category in
                            Button(category.name) {
                                pendingBulkCategory = category
                            }
                        }
                    }
                } else {
                    Button(actionTitle(action)) {
                        pendingBulkAction = action
                    }
                }
            }
        } label: {
            bulkButtonLabel("批量操作", systemImage: "chevron.up.chevron.down")
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(.plain)
        .disabled(model.bulkSelection.isEmpty || model.bulkRunningAction != nil)
        .help("选择批量操作")
    }

    private var exitBulkButton: some View {
        Button {
            model.toggleBulkMode()
        } label: {
            bulkButtonLabel("退出", systemImage: "xmark")
        }
        .buttonStyle(.plain)
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

    private var categoryConfirmation: BulkConfirmationCopy? {
        pendingBulkCategory.map {
            BulkToolbarPolicy.categoryConfirmation(category: $0, selectedCount: model.bulkSelection.count)
        }
    }

    private var resultMessage: String {
        guard let result = model.bulkResult else {
            return ""
        }

        var lines = [
            "成功 \(result.succeededCount) 篇 · 跳过 \(result.skippedCount) 篇 · 失败 \(result.issues.count) 篇"
        ]
        for issue in result.issues {
            let message = issue.message ?? "未知原因"
            lines.append("ID \(issue.articleID)：\(issue.code) · \(message)")
        }
        for publication in result.publications {
            lines.append("ID \(publication.articleID)：\(publication.publicURL)")
        }
        return lines.joined(separator: "\n")
    }

    private func actionTitle(_ action: BulkToolbarAction) -> String {
        BulkToolbarPolicy.confirmation(for: action, selectedCount: model.bulkSelection.count).confirmTitle
    }

    private func runBulkToolbarAction(_ action: BulkToolbarAction) {
        pendingBulkAction = nil
        Task {
            await model.runBulkToolbarAction(action)
        }
    }

    private func runBulkCategory(_ category: LibraryCategoryFilter) {
        pendingBulkCategory = nil
        Task {
            await model.runBulkCategory(category.id)
        }
    }

    private var searchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            TextField("搜索文章", text: $model.searchDraft)
                .textFieldStyle(.plain)
                .onSubmit(submitSearch)
            if !model.searchDraft.isEmpty {
                Button {
                    model.clearSearch()
                    reload()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .help("清除搜索")
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 28)
        .background(QiankunjieColors.surface(for: colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func submitSearch() {
        model.submitSearch()
        reload()
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
