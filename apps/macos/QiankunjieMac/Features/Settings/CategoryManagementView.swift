import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI
import UniformTypeIdentifiers

extension ArticleCategory: @retroactive Identifiable {}

struct CategoryManagementView: View {
    @State private var model: CategoryManagementModel
    @State private var mergingCategory: ArticleCategory?
    @State private var dragState = CategoryDragState()
    @Environment(\.colorScheme) private var colorScheme

    init(catalog: CategoryCatalogModel) {
        _model = State(initialValue: CategoryManagementModel(catalog: catalog))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            bodyContent
        }
        .frame(minWidth: 960, minHeight: 640)
        .background(QiankunjieColors.background(for: colorScheme))
        .statusToast(message: $model.weakNoticeMessage)
        .task {
            await model.load()
        }
        .onChange(of: model.catalog.userID) {
            mergingCategory = nil
            dragState.cancel()
            model.resetForUserChange()
        }
        .onChange(of: model.searchText) {
            dragState.cancel()
        }
        .onChange(of: model.catalog.canReorder) { _, canReorder in
            guard !canReorder else { return }
            dragState.cancel()
        }
        .onDisappear {
            dragState.cancel()
        }
        .sheet(isPresented: $model.isCreating) {
            CategoryQuickCreateView(
                catalog: model.catalog,
                primaryActionTitle: "创建分类",
                onCancel: {
                    model.cancelCreation()
                },
                onCompleted: { result in
                    model.didCompleteQuickCreate(result)
                }
            )
        }
        .sheet(item: $model.editingCategory) { category in
            CategoryEditorOverlay(model: model, category: category)
        }
        .sheet(item: $model.deletingCategory) { category in
            CategoryDeleteSheet(model: model, category: category)
        }
        .sheet(item: $mergingCategory) { category in
            CategoryMergeSheet(model: model, source: category)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("分类管理")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                Text("分类只用于组织已归档文章。搜索、排序或调整规则，不会改变文章的归档状态。")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 16)

            if model.catalog.isLoading, model.catalog.hasLoadedCatalog {
                HStack(spacing: 6) {
                    ProgressView()
                        .controlSize(.small)
                    Text("同步中…")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }

            Button {
                Task { await model.refresh() }
            } label: {
                Label("刷新", systemImage: "arrow.clockwise")
            }
            .disabled(isBusy || model.catalog.isLoading)
            .accessibilityLabel("刷新分类目录")

            Button {
                model.isCreating = true
            } label: {
                Label("新增分类", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.catalog.hasLoadedCatalog || isBusy)
            .accessibilityLabel("新增分类")
        }
        .padding(20)
    }

    @ViewBuilder
    private var bodyContent: some View {
        if model.catalog.isLoading, !model.catalog.hasLoadedCatalog {
            loadingState
        } else if let message = model.errorMessage, !model.catalog.hasLoadedCatalog {
            loadFailureState(message)
        } else if model.catalog.hasLoadedCatalog, model.catalog.categories.isEmpty {
            emptyCatalogState
        } else {
            workspace
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
            Text("正在加载分类…")
                .font(.headline)
            Text("分类目录会与归档文章中的分类保持一致。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadFailureState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            Text("分类目录加载失败")
                .font(.headline)
            Text(message)
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .multilineTextAlignment(.center)
            Button("重试") {
                Task { await model.load() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.catalog.isLoading)
            .accessibilityLabel("重新加载分类目录")
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyCatalogState: some View {
        VStack(spacing: 14) {
            Image(systemName: "square.stack.3d.up")
                .font(.system(size: 38, weight: .light))
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            Text("还没有分类")
                .font(.headline)
            Text("先创建一个分类，归档文章时就可以从分类目录中选择。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            Button("新增分类") {
                model.isCreating = true
            }
            .buttonStyle(.borderedProminent)
            .disabled(isBusy)
            .accessibilityLabel("创建第一个分类")
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        VStack(spacing: 0) {
            if let notice = model.noticeMessage {
                Group {
                    if model.shouldOfferRefreshAfterMerge {
                        refreshableNotice(notice)
                    } else {
                        messageBanner(
                            notice,
                            systemImage: "checkmark.circle.fill",
                            tint: .green,
                            onClose: model.clearNotice
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
            }

            if let error = model.errorMessage {
                messageBanner(
                    error,
                    systemImage: "exclamationmark.triangle.fill",
                    tint: .red,
                    onClose: model.clearError
                )
                .padding(.horizontal, 16)
                .padding(.top, model.noticeMessage == nil ? 12 : 8)
            }

            HStack(spacing: 0) {
                categoryList
                    .frame(minWidth: 300, idealWidth: 330, maxWidth: 380)

                Divider()

                categoryDetail
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var categoryList: some View {
        VStack(spacing: 0) {
            searchBar
                .padding(14)

            HStack {
                Text("全部分类")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                Spacer()
                Text("\(model.catalog.activeCategories.count) 个启用")
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 8)

            if model.filteredCategories.isEmpty {
                searchEmptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 7) {
                        ForEach(displayedCategories) { category in
                            categoryRow(category)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 14)
                    .animation(.snappy(duration: 0.2), value: displayedCategoryIDs)
                }
            }
        }
        .background(QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.42))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

            TextField("搜索分类名称", text: $model.searchText)
                .textFieldStyle(.plain)
                .accessibilityLabel("搜索分类")

            if !model.searchText.isEmpty {
                Button {
                    model.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("清空分类搜索")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 34)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var searchEmptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 26, weight: .light))
            Text("没有匹配的分类")
                .font(.callout.weight(.medium))
            if !model.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button("清空搜索") {
                    model.searchText = ""
                }
                .buttonStyle(.plain)
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
    }

    private func categoryRow(_ category: ArticleCategory) -> some View {
        let isSelected = model.selectedCategoryID == category.id
        let currentIndex = model.catalog.categories.firstIndex { $0.id == category.id }
        let canMoveUp = canMove(category, to: currentIndex.map { $0 - 1 })
        let canMoveDown = canMove(category, to: currentIndex.map { $0 + 1 })

        return HStack(spacing: 8) {
            Button {
                model.select(categoryID: category.id)
            } label: {
                HStack(spacing: 10) {
                    Circle()
                        .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                        .frame(width: 11, height: 11)
                        .opacity(category.isActive ? 1 : 0.45)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(category.name)
                                .font(.callout.weight(.medium))
                                .foregroundStyle(
                                    category.isActive
                                        ? QiankunjieColors.onSurface(for: colorScheme)
                                        : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                                )
                                .lineLimit(1)

                            if category.isSystem {
                                statusBadge("系统", color: WorkspacePalette.primary(for: colorScheme))
                            }
                        }

                        HStack(spacing: 6) {
                            Text("\(model.catalog.count(for: category.id)) 篇")
                            Text("·")
                            Text(category.isActive ? "启用中" : "已停用")
                                .foregroundStyle(category.isActive ? Color.green : Color.orange)
                        }
                        .font(.caption)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }

                    Spacer(minLength: 4)

                    if isSelected {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(categoryAccessibilityLabel(category))
            .accessibilityHint("打开分类详情")

            VStack(spacing: 2) {
                moveButton(
                    systemImage: "chevron.up",
                    label: "上移 \(category.name)",
                    enabled: canMoveUp
                ) {
                    Task { await model.reorder(moving: category.id, offset: -1) }
                }

                moveButton(
                    systemImage: "chevron.down",
                    label: "下移 \(category.name)",
                    enabled: canMoveDown
                ) {
                    Task { await model.reorder(moving: category.id, offset: 1) }
                }
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 8)
        .background(
            isSelected
                ? WorkspacePalette.primary(for: colorScheme).opacity(0.13)
                : QiankunjieColors.surface(for: colorScheme),
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 9)
                .strokeBorder(
                    isSelected
                        ? WorkspacePalette.primary(for: colorScheme).opacity(0.42)
                        : QiankunjieColors.outline(for: colorScheme)
                )
        }
        .contentShape(RoundedRectangle(cornerRadius: 9))
        .opacity(dragState.draggedCategoryID == category.id ? 0.58 : 1)
        .scaleEffect(dragState.draggedCategoryID == category.id ? 0.985 : 1)
        .onDrag {
            guard canDrag(category) else {
                dragState.cancel()
                return NSItemProvider()
            }
            guard dragState.begin(
                categoryID: category.id,
                categoryIDs: model.catalog.categories.map(\.id)
            ) else {
                return NSItemProvider()
            }
            return NSItemProvider(object: String(category.id) as NSString)
        }
        .onDragSessionUpdated { session in
            guard CategoryDragState.shouldCancel(for: session.phase) else { return }
            cancelCategoryDrag()
        }
        .onDrop(
            of: [UTType.text],
            delegate: CategoryReorderDropDelegate(
                targetCategoryID: category.id,
                targetIsSystem: category.isSystem,
                draggedCategoryID: dragState.draggedCategoryID,
                canDrop: canAcceptCategoryDrop,
                onEnter: previewCategoryMove,
                onDrop: commitCategoryMove,
                onCancel: cancelCategoryDrag
            )
        )
    }

    private func moveButton(
        systemImage: String,
        label: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 8, weight: .bold))
                .frame(width: 18, height: 13)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? QiankunjieColors.onSurfaceVariant(for: colorScheme) : Color.secondary.opacity(0.3))
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private var categoryDetail: some View {
        Group {
            if let category = model.selectedCategory {
                categoryDetailContent(category)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "rectangle.split.2x1")
                        .font(.system(size: 34, weight: .light))
                    Text("选择一个分类查看详情")
                        .font(.headline)
                    Text("可以在左侧搜索、排序，或选择分类后编辑规则。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private func categoryDetailContent(_ category: ArticleCategory) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .top, spacing: 14) {
                    Circle()
                        .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                        .frame(width: 18, height: 18)
                        .padding(.top, 6)

                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 8) {
                            Text(category.name)
                                .font(.title2.weight(.semibold))
                                .lineLimit(2)
                            if category.isSystem {
                                statusBadge("系统分类", color: WorkspacePalette.primary(for: colorScheme))
                            }
                            if !category.isActive {
                                statusBadge("已停用", color: .orange)
                            }
                        }

                        Text("\(model.catalog.count(for: category.id)) 篇归档文章")
                            .font(.callout)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }

                    Spacer(minLength: 12)

                    if category.isSystem {
                        Label("只读", systemImage: "lock")
                            .font(.callout.weight(.medium))
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(
                                QiankunjieColors.surfaceVariant(for: colorScheme),
                                in: Capsule()
                            )
                    } else {
                        Toggle(
                            "启用分类",
                            isOn: Binding(
                                get: { category.isActive },
                                set: { newValue in
                                    Task { await model.setActive(category, isActive: newValue) }
                                }
                            )
                        )
                        .toggleStyle(.switch)
                        .disabled(isBusy)
                        .accessibilityLabel("启用分类 \(category.name)")
                    }
                }

                if category.isSystem {
                    Text("“待整理”是系统分类，只能查看，不能编辑、停用、删除或合并。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            QiankunjieColors.surfaceVariant(for: colorScheme),
                            in: RoundedRectangle(cornerRadius: 9)
                        )
                }

                detailSection(title: "分类说明") {
                    Text(category.articleDescription?.isEmpty == false
                        ? category.articleDescription!
                        : "尚未设置分类说明。"
                    )
                    .font(.callout)
                    .foregroundStyle(
                        category.articleDescription?.isEmpty == false
                            ? QiankunjieColors.onSurface(for: colorScheme)
                            : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                    )
                    .fixedSize(horizontal: false, vertical: true)
                }

                HStack(alignment: .top, spacing: 14) {
                    ruleCard(
                        title: "适合收录",
                        systemImage: "checkmark.circle",
                        examples: category.includeExamples
                    )
                    ruleCard(
                        title: "不适合收录",
                        systemImage: "minus.circle",
                        examples: category.excludeExamples
                    )
                }

                detailSection(title: "显示颜色") {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                            .frame(width: 18, height: 18)
                        Text(category.color ?? "使用默认强调色")
                            .font(.system(.callout, design: .monospaced))
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }

                if !category.isSystem {
                    Divider()
                    HStack(spacing: 10) {
                        Button {
                            model.editingCategory = category
                        } label: {
                            Label("编辑高级规则", systemImage: "slider.horizontal.3")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isBusy)

                        Button {
                            mergingCategory = category
                        } label: {
                            Label("合并分类…", systemImage: "arrow.triangle.merge")
                        }
                        .disabled(isBusy)

                        Spacer()

                        Button(role: .destructive) {
                            model.deletingCategory = category
                        } label: {
                            Label("删除并迁移…", systemImage: "trash")
                        }
                        .disabled(isBusy)
                    }
                }
            }
            .padding(24)
        }
    }

    private func detailSection<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func ruleCard(
        title: String,
        systemImage: String,
        examples: [String]
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Label(title, systemImage: systemImage)
                .font(.headline)

            if examples.isEmpty {
                Text("尚未定义")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            } else {
                ForEach(Array(examples.enumerated()), id: \.offset) { _, example in
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Circle()
                            .fill(QiankunjieColors.onSurfaceVariant(for: colorScheme).opacity(0.55))
                            .frame(width: 4, height: 4)
                        Text(example)
                            .font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 10))
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func messageBanner(
        _ message: String,
        systemImage: String,
        tint: Color,
        onClose: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Image(systemName: systemImage)
                .foregroundStyle(tint)
            Text(message)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button("关闭", action: onClose)
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("关闭提示")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func refreshableNotice(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Image(systemName: "arrow.clockwise.circle.fill")
                .foregroundStyle(.green)
            Text(message)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button("刷新分类目录") {
                Task { await model.load() }
            }
            .buttonStyle(.plain)
            .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            .disabled(model.catalog.isLoading)
            Button("关闭") {
                model.clearNotice()
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .accessibilityLabel("关闭提示")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func statusBadge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(color.opacity(0.1), in: Capsule())
    }

    private var isBusy: Bool {
        model.isBusy
    }

    private var displayedCategories: [ArticleCategory] {
        guard let dragPreviewCategoryIDs = dragState.previewCategoryIDs else {
            return model.filteredCategories
        }
        let order = Dictionary(uniqueKeysWithValues: dragPreviewCategoryIDs.enumerated().map {
            ($0.element, $0.offset)
        })
        return model.filteredCategories.sorted {
            (order[$0.id] ?? .max) < (order[$1.id] ?? .max)
        }
    }

    private var displayedCategoryIDs: [Int] {
        displayedCategories.map(\.id)
    }

    private func canDrag(_ category: ArticleCategory) -> Bool {
        !category.isSystem
            && model.catalog.canReorder
            && !model.isSaving
            && !model.isOptimizing
            && model.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func canAcceptCategoryDrop() -> Bool {
        model.catalog.canReorder
            && !model.isSaving
            && !model.isOptimizing
            && model.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func canMove(_ category: ArticleCategory, to targetIndex: Int?) -> Bool {
        guard !category.isSystem, canAcceptCategoryDrop(), let targetIndex else { return false }
        guard model.catalog.categories.indices.contains(targetIndex) else { return false }
        return !model.catalog.categories[targetIndex].isSystem
    }

    private func categoryAccessibilityLabel(_ category: ArticleCategory) -> String {
        let count = model.catalog.count(for: category.id)
        let state = category.isActive ? "启用中" : "已停用"
        let kind = category.isSystem ? "系统分类" : "用户分类"
        return "\(category.name)，\(count) 篇文章，\(state)，\(kind)"
    }

    private func previewCategoryMove(_ movingCategoryID: Int, _ targetCategoryID: Int) {
        let protectedIDs = Set(model.catalog.categories.filter(\.isSystem).map(\.id))
        var nextState = dragState
        guard nextState.preview(
            moving: movingCategoryID,
            to: targetCategoryID,
            protecting: protectedIDs
        ) else {
            return
        }
        withAnimation(.snappy(duration: 0.18)) {
            dragState = nextState
        }
    }

    private func commitCategoryMove(_ movingCategoryID: Int, _ targetCategoryID: Int) {
        guard let categoryIDs = dragState.commit() else {
            return
        }
        Task { @MainActor in
            _ = await model.reorder(categoryIDs: categoryIDs)
        }
    }

    private func cancelCategoryDrag() {
        guard dragState.draggedCategoryID != nil || dragState.previewCategoryIDs != nil else {
            return
        }
        withAnimation(.snappy(duration: 0.18)) {
            dragState.cancel()
        }
    }
}

private struct CategoryReorderDropDelegate: DropDelegate {
    let targetCategoryID: Int
    let targetIsSystem: Bool
    let draggedCategoryID: Int?
    let canDrop: () -> Bool
    let onEnter: (Int, Int) -> Void
    let onDrop: (Int, Int) -> Void
    let onCancel: () -> Void

    func dropUpdated(info: DropInfo) -> DropProposal? {
        guard case .move = resolution else {
            return DropProposal(operation: .forbidden)
        }
        return DropProposal(operation: .move)
    }

    func dropEntered(info: DropInfo) {
        guard case let .move(movingCategoryID, targetCategoryID) = resolution else { return }
        onEnter(movingCategoryID, targetCategoryID)
    }

    func performDrop(info: DropInfo) -> Bool {
        guard case let .move(movingCategoryID, targetCategoryID) = resolution else {
            onCancel()
            return false
        }
        onDrop(movingCategoryID, targetCategoryID)
        return true
    }

    private var resolution: CategoryDropResolution {
        CategoryDragState.dropResolution(
            draggedCategoryID: draggedCategoryID,
            targetCategoryID: targetCategoryID,
            targetIsSystem: targetIsSystem,
            canDrop: canDrop()
        )
    }
}

private struct CategoryDeleteSheet: View {
    let model: CategoryManagementModel
    let category: ArticleCategory
    @Environment(\.dismiss) private var dismiss
    @State private var targetCategoryID: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label("删除“\(category.name)”", systemImage: "trash")
                    .font(.title2.weight(.semibold))
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭删除分类")
            }

            Text("删除前必须选择一个启用中的目标分类，现有 \(model.catalog.count(for: category.id)) 篇归档文章会迁移过去。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)

            if availableTargets.isEmpty {
                Text("当前没有可接收文章的目标分类，请先启用或创建其他分类。")
                    .font(.callout)
                    .foregroundStyle(.orange)
            } else {
                Picker("文章迁移到", selection: $targetCategoryID) {
                    Text("请选择目标分类").tag(Int?.none)
                    ForEach(availableTargets) { target in
                        Text("\(target.name)（\(model.catalog.count(for: target.id)) 篇）")
                            .tag(Optional(target.id))
                    }
                }
                .pickerStyle(.menu)
                .accessibilityLabel("选择文章迁移目标分类")
            }

            if let error = model.errorMessage {
                Text(error)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Button("取消") {
                    dismiss()
                }
                .disabled(model.isSaving)

                Spacer()

                Button(model.isSaving ? "正在迁移…" : "迁移并删除", role: .destructive) {
                    guard let targetCategoryID else { return }
                    Task {
                        await model.delete(category, targetCategoryID: targetCategoryID)
                        if model.errorMessage == nil {
                            dismiss()
                        }
                    }
                }
                .disabled(targetCategoryID == nil || model.isSaving)
            }
        }
        .padding(24)
        .frame(width: 500)
        .background(QiankunjieColors.surface(for: colorScheme))
        .onChange(of: model.deletingCategory) {
            if model.deletingCategory == nil {
                dismiss()
            }
        }
    }

    @Environment(\.colorScheme) private var colorScheme

    private var availableTargets: [ArticleCategory] {
        model.catalog.activeCategories.filter { $0.id != category.id }
    }
}

private struct CategoryMergeSheet: View {
    let model: CategoryManagementModel
    let source: ArticleCategory
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var targetCategoryID: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label("合并“\(source.name)”", systemImage: "arrow.triangle.merge")
                    .font(.title2.weight(.semibold))
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭合并分类")
            }

            Text("合并前必须选择目标分类。源分类中的 \(model.catalog.count(for: source.id)) 篇文章会迁移到目标分类，源分类随后停用，并保留在已停用分类中。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)

            if availableTargets.isEmpty {
                Text("当前没有可接收文章的目标分类，请先启用或创建其他分类。")
                    .font(.callout)
                    .foregroundStyle(.orange)
            } else {
                Picker("合并到", selection: $targetCategoryID) {
                    Text("请选择目标分类").tag(Int?.none)
                    ForEach(availableTargets) { target in
                        Text("\(target.name)（\(model.catalog.count(for: target.id)) 篇）")
                            .tag(Optional(target.id))
                    }
                }
                .pickerStyle(.menu)
                .accessibilityLabel("选择合并目标分类")
            }

            if let error = model.errorMessage {
                Text(error)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Button("取消") {
                    dismiss()
                }
                .disabled(model.isSaving)

                Spacer()

                Button(model.isSaving ? "正在合并…" : "确认合并") {
                    guard
                        let targetCategoryID,
                        let target = model.catalog.categories.first(where: { $0.id == targetCategoryID })
                    else {
                        return
                    }
                    Task {
                        await model.merge(source, into: target)
                        if model.errorMessage == nil {
                            dismiss()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(targetCategoryID == nil || model.isSaving)
            }
        }
        .padding(24)
        .frame(width: 500)
        .background(QiankunjieColors.surface(for: colorScheme))
    }

    private var availableTargets: [ArticleCategory] {
        model.catalog.activeCategories.filter { $0.id != source.id }
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
