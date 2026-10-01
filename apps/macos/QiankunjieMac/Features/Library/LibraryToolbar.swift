import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct LibraryToolbar: View {
    @Bindable var model: LibraryModel
    @Binding var presentationMode: ArticleListPresentationMode
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            controls
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
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

            searchField
                .frame(minWidth: 88, maxWidth: 240)
                .layoutPriority(-1)

            presentationModeButton

            refreshButton
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
