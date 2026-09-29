import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct LibraryToolbar: View {
    @Bindable var model: LibraryModel
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
                    .font(QiankunjieTypography.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                subtitle
            }

            Spacer(minLength: 12)

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
        .font(QiankunjieTypography.labelMedium)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        .lineLimit(1)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                searchField
                    .frame(minWidth: 160, maxWidth: 250)
                orderButton
            }
            HStack(spacing: 8) {
                sortPicker
                sourcePicker
            }
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
                Text(model.sort.title)
                    .lineLimit(1)
            }
            .frame(width: 112, height: 28)
        }
        .disabled(!model.appliedSearchText.isEmpty)
        .help("选择排序")
    }

    private var orderButton: some View {
        Button {
            model.toggleOrder()
            reload()
        } label: {
            Image(systemName: model.order == .asc ? "arrow.up" : "arrow.down")
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.bordered)
        .disabled(!model.appliedSearchText.isEmpty)
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
                Image(systemName: "line.3.horizontal.decrease.circle")
            Text(model.source ?? "全部来源")
                .lineLimit(1)
            }
            .frame(minWidth: 120, maxWidth: .infinity, alignment: .leading)
            .frame(height: 28)
            .padding(.horizontal, 8)
        }
        .disabled(!model.isSourceFilterAvailable)
        .help("选择归档来源")
    }

    private var refreshButton: some View {
        Button {
            reload(reset: false)
        } label: {
            Image(systemName: "arrow.clockwise")
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.bordered)
        .help("刷新资料库")
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
        case .collected: "收藏时间"
        case .published: "发布时间"
        case .favorited: "喜欢时间"
        case .archived: "归档时间"
        }
    }
}
