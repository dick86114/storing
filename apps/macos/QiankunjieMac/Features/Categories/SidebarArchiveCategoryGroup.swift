import Foundation
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct SidebarArchiveCategoryGroup: View {
    @Bindable var model: AppModel
    @Binding var isExpanded: Bool
    @Environment(\.colorScheme) private var colorScheme
    @State private var isQuickCreatePresented = false
    @State private var dragState = CategoryDragState()
    @State private var rowFrames: [Int: CGRect] = [:]
    @State private var weakNoticeMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            archiveRow

            if model.isAuthenticated, isExpanded {
                categoryContent
            }
        }
        .coordinateSpace(name: SidebarCategoryDragLayout.coordinateSpaceName)
        .onPreferenceChange(CategoryRowFramePreferenceKey.self) { frames in
            rowFrames = frames
        }
        .selectionDisabled()
        .listRowBackground(Color.clear)
        .statusToast(message: $weakNoticeMessage)
        .onChange(of: model.categoryCatalog.userID) {
            dragState.cancel()
        }
        .onChange(of: model.categoryCatalog.canReorder) { _, canReorder in
            guard !canReorder else { return }
            dragState.cancel()
        }
        .onChange(of: isExpanded) { _, expanded in
            guard !expanded else { return }
            dragState.cancel()
        }
        .onDisappear {
            dragState.cancel()
        }
        .sheet(isPresented: $isQuickCreatePresented) {
            CategoryQuickCreateView(
                catalog: model.categoryCatalog,
                onSubmit: model.createCategory,
                onCancel: {
                    isQuickCreatePresented = false
                },
                onCompleted: { result in
                    let category = result.category
                    weakNoticeMessage = result.creationNotice
                    model.selectCategory(category.id)
                    if model.selectedCategoryID == category.id {
                        isQuickCreatePresented = false
                    } else {
                        model.categoryCatalog.presentError(result.navigationFailureMessage)
                    }
                }
            )
        }
    }

    private var archiveRow: some View {
        HStack(spacing: 8) {
            Button(action: selectArchiveDestination) {
                HStack(spacing: 8) {
                    Image(systemName: AppDestination.archive.selectedSystemImage(
                        isSelected: isArchiveSelected
                    ))
                        .frame(width: 18)

                    Text(AppDestination.archive.title)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    if model.categoryCatalog.isLoading, model.categoryCatalog.hasLoadedCatalog {
                        ProgressView()
                            .controlSize(.mini)
                            .frame(width: 12, height: 12)
                            .help("正在同步分类")
                            .accessibilityLabel("正在同步分类")
                    } else if
                        let errorMessage = model.categoryCatalog.errorMessage,
                        !activeCategoryIDs.isEmpty
                    {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(
                                colorScheme == .dark
                                    ? QiankunjieColors.darkError
                                    : QiankunjieColors.lightError
                            )
                            .help(errorMessage)
                            .accessibilityLabel("分类同步失败：\(errorMessage)")
                    }

                    if let count = model.libraryModel.count(for: .archive) {
                        Text("\(count)")
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .help("打开全部归档")
            .accessibilityLabel("打开全部归档")
            .accessibilityHint("显示归档中的全部文章")

            if model.isAuthenticated {
                Button(action: toggleArchiveExpansion) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 14, height: 18)
                        .contentShape(Rectangle())
                }
                .buttonStyle(QiankunjiePlainButtonStyle())
                .help(isExpanded ? "收起分类" : "展开分类")
                .accessibilityLabel(isExpanded ? "收起归档分类" : "展开归档分类")
            }
        }
        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        .padding(.vertical, 2)
        .background {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isArchiveSelected ? selectionFill : Color.clear)
        }
    }

    private func selectArchiveDestination() {
        guard !isArchiveSelected else { return }
        model.selectCategory(nil)
    }

    private func toggleArchiveExpansion() {
        guard model.isAuthenticated else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            isExpanded.toggle()
        }
    }

    @ViewBuilder
    private var categoryContent: some View {
        if model.categoryCatalog.isLoading, model.categoryCatalog.activeCategories.isEmpty {
            statusRow {
                ProgressView()
                    .controlSize(.mini)
                Text("正在加载分类…")
            }
        } else if model.categoryCatalog.activeCategories.isEmpty {
            if let errorMessage = model.categoryCatalog.errorMessage {
                failureRow(errorMessage)
            } else {
                statusRow {
                    Text("暂无启用分类")
                }
            }
        } else {
            ForEach(model.categoryCatalog.activeCategories, id: \.id) { category in
                categoryRow(category)
            }
            .animation(.snappy(duration: 0.22), value: activeCategoryIDs)
        }

        quickCreateRow
        managementRow
    }

    @ViewBuilder
    private func categoryRow(_ category: ArticleCategory) -> some View {
        if category.isSystem {
            styledCategoryRow(category)
        } else {
            styledCategoryRow(category)
                .highPriorityGesture(sidebarDragGesture(for: category))
        }
    }

    private func styledCategoryRow(_ category: ArticleCategory) -> some View {
        let isDragging = dragState.draggedCategoryID == category.id
        let dropPlacement = dragState.dropTarget?.categoryID == category.id
            ? dragState.dropTarget?.placement
            : nil

        return categoryRowContent(category)
            .recordCategoryRowFrame(
                categoryID: category.id,
                in: SidebarCategoryDragLayout.coordinateSpaceName
            )
            .offset(y: isDragging ? dragState.translation.height : 0)
            .scaleEffect(isDragging ? 1.015 : 1)
            .shadow(
                color: isDragging ? Color.black.opacity(0.16) : .clear,
                radius: isDragging ? 7 : 0,
                y: isDragging ? 3 : 0
            )
            .zIndex(isDragging ? 1 : 0)
            .overlay(alignment: .top) {
                if dropPlacement == .before {
                    CategoryDropIndicator(
                        placement: .before,
                        color: QiankunjieColors.accent(for: colorScheme)
                    )
                }
            }
            .overlay(alignment: .bottom) {
                if dropPlacement == .after {
                    CategoryDropIndicator(
                        placement: .after,
                        color: QiankunjieColors.accent(for: colorScheme)
                    )
                }
            }
            .animation(.snappy(duration: 0.18), value: isDragging)
    }

    private func categoryRowContent(_ category: ArticleCategory) -> some View {
        let isSelected = model.destination == .archive
            && model.selectedCategoryID == category.id

        return Button {
            model.selectCategory(category.id)
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(hexString: category.color) ?? categoryFallbackColor)
                    .frame(width: 7, height: 7)
                    .frame(width: 18)

                Text(category.name)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer(minLength: 0)

                Text("\(model.categoryCatalog.count(for: category.id))")
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
            .padding(.leading, 18)
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isSelected ? selectionFill : Color.clear)
            }
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .help("查看分类：\(category.name)")
        .accessibilityLabel("\(category.name)，\(model.categoryCatalog.count(for: category.id)) 篇文章")
        .accessibilityHint("打开分类详情")
    }

    private func sidebarDragGesture(for category: ArticleCategory) -> some Gesture {
        DragGesture(
            minimumDistance: 0,
            coordinateSpace: .named(SidebarCategoryDragLayout.coordinateSpaceName)
        )
        .onChanged { value in
            guard
                hypot(value.translation.width, value.translation.height)
                    >= CategoryDragState.activationDistance
            else {
                return
            }
            guard canDrag(category) else {
                cancelCategoryDrag()
                return
            }
            if dragState.draggedCategoryID == nil {
                guard dragState.begin(
                    categoryID: category.id,
                    categoryIDs: model.categoryCatalog.categories.map(\.id)
                ) else {
                    return
                }
            }
            guard dragState.draggedCategoryID == category.id else { return }
            dragState.update(
                translation: value.translation,
                pointerY: value.location.y,
                pointerX: value.location.x,
                rows: categoryDragRows,
                protecting: protectedCategoryIDs,
                canDrop: canAcceptCategoryDrop()
            )
        }
        .onEnded { value in
            guard
                hypot(value.translation.width, value.translation.height)
                    >= CategoryDragState.activationDistance
            else {
                cancelCategoryDrag()
                model.selectCategory(category.id)
                return
            }
            guard dragState.draggedCategoryID == category.id else { return }
            dragState.update(
                translation: value.translation,
                pointerY: value.location.y,
                pointerX: value.location.x,
                rows: categoryDragRows,
                protecting: protectedCategoryIDs,
                canDrop: canAcceptCategoryDrop()
            )
            guard let commit = dragState.finish(
                protecting: protectedCategoryIDs,
                canDrop: canAcceptCategoryDrop()
            ) else {
                cancelCategoryDrag()
                return
            }

            Task { @MainActor in
                do {
                    try await model.categoryCatalog.reorder(
                        categoryIDs: commit.reorderedCategoryIDs
                    )
                    weakNoticeMessage = "分类顺序已更新"
                } catch {
                    // 目录模型已负责回滚顺序并保留错误信息。
                }
            }
        }
    }

    private func canDrag(_ category: ArticleCategory) -> Bool {
        !category.isSystem && model.categoryCatalog.canReorder
    }

    private func canAcceptCategoryDrop() -> Bool {
        model.categoryCatalog.canReorder
    }

    private var protectedCategoryIDs: Set<Int> {
        Set(model.categoryCatalog.categories.filter(\.isSystem).map(\.id))
    }

    private var categoryDragRows: [CategoryDragRowFrame] {
        model.categoryCatalog.activeCategories.compactMap { category in
            rowFrames[category.id].map {
                CategoryDragRowFrame(categoryID: category.id, frame: $0)
            }
        }
    }

    private func cancelCategoryDrag() {
        guard dragState.isDragging else { return }
        withAnimation(.snappy(duration: 0.18)) {
            dragState.cancel()
        }
    }

    private var managementRow: some View {
        Button {
            model.selectDestination(.categories)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: AppDestination.categories.systemImage)
                    .frame(width: 18)

                Text("管理分类…")
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .padding(.leading, 18)
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .help("管理分类")
        .accessibilityLabel("管理分类")
    }

    private var quickCreateRow: some View {
        Button {
            isQuickCreatePresented = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle")
                    .frame(width: 18)

                Text("新建分类…")
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .padding(.leading, 18)
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .help("新建分类")
        .accessibilityLabel("新建分类")
    }

    private func failureRow(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError)

            Text(message)
                .font(.caption)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 4)

            Button("重试") {
                Task {
                    await model.categoryCatalog.load()
                }
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .font(.caption)
            .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            .accessibilityLabel("重新加载分类")
        }
        .padding(.leading, 22)
        .padding(.trailing, 4)
        .padding(.vertical, 3)
    }

    private func statusRow<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 6) {
            content()
        }
        .font(.caption)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        .padding(.leading, 22)
        .padding(.trailing, 4)
        .padding(.vertical, 3)
    }

    private var isArchiveSelected: Bool {
        model.destination == .archive && model.selectedCategoryID == nil
    }

    private var activeCategoryIDs: [Int] {
        model.categoryCatalog.activeCategories.map(\.id)
    }

    private var selectionFill: Color {
        QiankunjieColors.accent(for: colorScheme).opacity(0.12)
    }

    private var categoryFallbackColor: Color {
        QiankunjieColors.accent(for: colorScheme)
    }
}

private enum SidebarCategoryDragLayout {
    static let coordinateSpaceName = "sidebar-category-drag"
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
