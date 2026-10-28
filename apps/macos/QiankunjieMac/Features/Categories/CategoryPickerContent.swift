import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

private enum 选择器行: Hashable {
    case ai
    case category(Int)
    case create
}

struct CategoryPickerContent: View {
    @Bindable var model: CategoryPickerModel
    let title: String
    let subtitle: String
    let onSelectCategory: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    let onSelectAI: @MainActor () async -> CategoryAssignmentOutcome
    let onDismiss: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var isSearchFocused: Bool
    @State private var focusedRow: 选择器行?

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        searchField
                        aiButton
                        operationErrors
                        sameNameSuggestionBanner

                        categoryContent

                        if model.canCreate {
                            createButton
                        } else if !model.hasActiveCategories
                            && normalizedQuery.isEmpty
                            && !model.isInitialCatalogLoading
                            && model.catalogErrorMessage == nil {
                            firstCategoryButton
                        }

                        if model.isSubmitting {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .controlSize(.small)
                                Text("正在应用分类…")
                                    .qiankunjieFont(.labelMedium)
                                    .foregroundStyle(
                                        QiankunjieColors.onSurfaceVariant(for: colorScheme)
                                    )
                            }
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 4)
                        }
                    }
                    .padding(18)
                }
                .onChange(of: focusedRow) { _, row in
                    guard let row else { return }
                    withAnimation(.easeOut(duration: 0.16)) {
                        proxy.scrollTo(row, anchor: .center)
                    }
                }
            }
        }
        .frame(minWidth: 420, idealWidth: 480, maxWidth: 540)
        .frame(minHeight: 520, idealHeight: 590, maxHeight: 680)
        .background(QiankunjieColors.surface(for: colorScheme))
        .task {
            isSearchFocused = true
            await model.loadCatalogIfNeeded()
            isSearchFocused = true
        }
        .onChange(of: model.query) {
            focusedRow = nil
        }
        .onChange(of: model.currentUserID) {
            if model.isStaleForCurrentUser {
                onDismiss()
            }
        }
        .onKeyPress(.upArrow) {
            移动键盘焦点(向前: true)
            return .handled
        }
        .onKeyPress(.downArrow) {
            移动键盘焦点(向前: false)
            return .handled
        }
        .onKeyPress(.escape) {
            dismissIfPossible()
            return .handled
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .qiankunjieFont(.titleLarge)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Text(subtitle)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
                Text("本次处理 \(model.targetCount) 篇文章")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            }

            Spacer(minLength: 8)

            Button {
                dismissIfPossible()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 26, height: 26)
                    .contentShape(Rectangle())
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .disabled(!canDismiss)
            .accessibilityLabel("关闭分类选择")
            .help("关闭分类选择")
        }
        .padding(18)
    }

    private var searchField: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

            TextField("搜索分类或输入新分类名称", text: $model.query)
                .textFieldStyle(.plain)
                .focused($isSearchFocused)
                .onSubmit {
                    激活当前键盘行()
                }
                .accessibilityLabel("搜索分类")
                .accessibilityHint("输入名称筛选启用分类；没有同名分类时会显示创建操作")

            if !model.query.isEmpty {
                Button {
                    model.query = ""
                    isSearchFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                .buttonStyle(QiankunjiePlainButtonStyle())
                .accessibilityLabel("清空分类搜索")
                .help("清空分类搜索")
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.7),
            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .strokeBorder(
                    isSearchFocused
                        ? QiankunjieColors.accent(for: colorScheme).opacity(0.8)
                        : QiankunjieColors.outline(for: colorScheme),
                    lineWidth: isSearchFocused ? 1.5 : 1
                )
        }
    }

    private var aiButton: some View {
        Button {
            focusedRow = .ai
            使用AI判断()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                VStack(alignment: .leading, spacing: 2) {
                    Text("由 AI 判断")
                        .qiankunjieFont(.bodyMedium)
                    Text("低置信度的文章会进入「待整理」")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(
                            QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
                Spacer()
                if focusedRow == .ai {
                    Image(systemName: "return")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(
                            QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                QiankunjieColors.accent(for: colorScheme).opacity(
                    focusedRow == .ai ? 0.2 : 0.11
                ),
                in: RoundedRectangle(cornerRadius: 9, style: .continuous)
            )
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(
            isBusy
                || (model.catalogErrorMessage != nil && !model.hasActiveCategories)
        )
        .accessibilityLabel("由 AI 判断 \(model.targetCount) 篇文章的分类")
        .accessibilityHint("让 AI 根据文章内容选择分类")
        .help("让 AI 根据文章内容选择分类")
        .id(选择器行.ai)
    }

    @ViewBuilder
    private var categoryContent: some View {
        if model.isInitialCatalogLoading {
            HStack(spacing: 9) {
                ProgressView()
                    .controlSize(.small)
                Text("正在加载分类…")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
        } else if let message = model.catalogErrorMessage,
                  message != model.errorMessage,
                  !model.hasActiveCategories {
            catalogErrorState(message)
        } else if !model.hasActiveCategories {
            emptyState(
                title: normalizedQuery.isEmpty ? "还没有可用分类" : "没有匹配的分类",
                message: normalizedQuery.isEmpty
                    ? "输入名称后可以创建第一个分类。"
                    : "暂时没有同名分类，可直接创建。"
            )
        } else {
            if !model.recentCategories.isEmpty {
                sectionTitle("最近使用")
                ForEach(model.recentCategories) { category in
                    categoryButton(category)
                }
            }

            if !model.filteredCategories.isEmpty {
                sectionTitle(normalizedQuery.isEmpty ? "全部分类" : "搜索结果")
                ForEach(model.filteredCategories) { category in
                    categoryButton(category)
                }
            } else if !normalizedQuery.isEmpty && model.exactMatch == nil {
                emptyState(
                    title: "没有匹配的分类",
                    message: "没有同名分类，可直接创建。"
                )
            }
        }
    }

    private var createButton: some View {
        Button {
            focusedRow = .create
            创建并分类()
        } label: {
            HStack(spacing: 9) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                Text("创建并分类「\(normalizedQuery)」")
                    .qiankunjieFont(.bodyMedium)
                    .lineLimit(1)
                Spacer()
                if focusedRow == .create {
                    Image(systemName: "return")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(
                            QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(
                QiankunjieColors.accent(for: colorScheme).opacity(
                    focusedRow == .create ? 0.16 : 0.09
                ),
                in: RoundedRectangle(cornerRadius: 9, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .strokeBorder(
                        QiankunjieColors.accent(for: colorScheme).opacity(
                            focusedRow == .create ? 0.8 : 0.28
                        )
                    )
            }
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(isBusy)
        .accessibilityLabel("创建分类 \(normalizedQuery) 并完成分类")
        .accessibilityHint("创建后立即应用到 \(model.targetCount) 篇文章")
        .help("创建后立即应用到 \(model.targetCount) 篇文章")
        .id(选择器行.create)
    }

    private var firstCategoryButton: some View {
        Button {
            isSearchFocused = true
        } label: {
            Label("创建第一个分类", systemImage: "plus.circle")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(
                    QiankunjieColors.accent(for: colorScheme).opacity(0.09),
                    in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                )
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(isBusy)
        .accessibilityLabel("创建第一个分类")
        .accessibilityHint("将焦点移到分类名称输入框")
        .help("输入分类名称")
    }

    private func categoryButton(_ category: ArticleCategory) -> some View {
        let isCurrent = category.id == model.selectedCategoryID
        let row = 选择器行.category(category.id)
        let isFocused = focusedRow == row
        let indicatorColor = Color(hexString: category.color)
            ?? QiankunjieColors.accent(for: colorScheme)
        let backgroundColor = QiankunjieColors.surface(for: colorScheme)
            .opacity(isFocused ? 1 : 0.72)
        let borderColor = isFocused
            ? QiankunjieColors.accent(for: colorScheme).opacity(0.75)
            : QiankunjieColors.outline(for: colorScheme).opacity(0.75)

        return Button {
            focusedRow = row
            选择已有分类(category)
        } label: {
            categoryRowLabel(
                category,
                isCurrent: isCurrent,
                isFocused: isFocused,
                indicatorColor: indicatorColor,
                backgroundColor: backgroundColor,
                borderColor: borderColor
            )
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(isBusy || isCurrent)
        .accessibilityLabel(
            isCurrent ? "当前分类，\(category.name)" : "选择分类，\(category.name)"
        )
        .accessibilityHint("将 \(model.targetCount) 篇文章归档到该分类")
        .help(isCurrent ? "当前分类" : "将文章归档到「\(category.name)」")
        .id(row)
    }

    private func categoryRowLabel(
        _ category: ArticleCategory,
        isCurrent: Bool,
        isFocused: Bool,
        indicatorColor: Color,
        backgroundColor: Color,
        borderColor: Color
    ) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(indicatorColor)
                .frame(width: 9, height: 9)

            Text(category.name)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .lineLimit(1)

            Spacer(minLength: 8)

            if isCurrent {
                Text("当前")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(
                        QiankunjieColors.onSurfaceVariant(for: colorScheme)
                    )
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(
                        QiankunjieColors.surfaceVariant(for: colorScheme),
                        in: Capsule()
                    )
            } else if isFocused {
                Image(systemName: "return")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(
                        QiankunjieColors.onSurfaceVariant(for: colorScheme)
                    )
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            backgroundColor,
            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .strokeBorder(borderColor)
        }
    }

    private var operationErrors: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let message = model.errorMessage {
                operationError(message)
            }

            if let message = model.catalogErrorMessage,
               message != model.errorMessage {
                catalogFailureBanner(message)
            }
        }
    }

    @ViewBuilder
    private var sameNameSuggestionBanner: some View {
        if let suggestion = model.existingCategorySuggestion,
           suggestion.id != model.selectedCategoryID {
            Button {
                使用现有分类建议()
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "arrow.turn.down.right")
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("已存在同名分类")
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        Text("使用现有分类「\(suggestion.name)」")
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    }
                    Spacer(minLength: 0)
                }
                .padding(11)
                .background(
                    QiankunjieColors.accent(for: colorScheme).opacity(0.09),
                    in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                )
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .disabled(isBusy)
            .accessibilityLabel("使用现有分类 \(suggestion.name)")
            .help("使用现有分类「\(suggestion.name)」")
        }
    }

    private func operationError(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(errorColor)
            Text(message)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 6)
            Button {
                model.clearError()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.semibold))
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .accessibilityLabel("关闭错误提示")
            .help("关闭错误提示")
        }
        .padding(10)
        .background(
            errorColor.opacity(0.09),
            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
        )
    }

    private func catalogFailureBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: "wifi.exclamationmark")
                .foregroundStyle(errorColor)
            VStack(alignment: .leading, spacing: 6) {
                Text("分类目录未能刷新：\(message)")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
                Button("重新加载") {
                    Task { @MainActor in
                        await model.reloadCatalog()
                    }
                }
                .buttonStyle(.link)
                .disabled(isBusy)
                .accessibilityLabel("重新加载分类目录")
            }
            Spacer()
        }
        .padding(10)
        .background(
            errorColor.opacity(0.09),
            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
        )
    }

    private func catalogErrorState(_ message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .font(.title2)
                .foregroundStyle(errorColor)
            Text("分类加载失败")
                .qiankunjieFont(.titleMedium)
            Text(message)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .multilineTextAlignment(.center)
            Button("重新加载") {
                Task { @MainActor in
                    await model.reloadCatalog()
                }
            }
            .disabled(isBusy)
            .accessibilityLabel("重新加载分类目录")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .qiankunjieFont(.labelMedium)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .padding(.top, 2)
    }

    private func emptyState(title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
            Text(message)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
    }

    private var keyboardCategories: [ArticleCategory] {
        var seen = Set<Int>()
        return (model.recentCategories + model.filteredCategories).filter {
            seen.insert($0.id).inserted
        }
    }

    private var keyboardRows: [选择器行] {
        var rows: [选择器行] = [.ai]
        rows.append(contentsOf: keyboardCategories.map { .category($0.id) })
        if model.canCreate {
            rows.append(.create)
        }
        return rows
    }

    private var normalizedQuery: String {
        model.query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isBusy: Bool {
        model.isInteractionDisabled
    }

    private var canDismiss: Bool {
        !model.isSubmitting && !model.isCatalogMutating
    }

    private var errorColor: Color {
        colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError
    }

    private func 移动键盘焦点(向前: Bool) {
        let rows = keyboardRows
        guard !rows.isEmpty else { return }

        guard let focusedRow,
              let currentIndex = rows.firstIndex(of: focusedRow)
        else {
            self.focusedRow = 向前 ? rows.last : rows.first
            return
        }

        let offset = 向前 ? -1 : 1
        let nextIndex = min(max(currentIndex + offset, 0), rows.count - 1)
        self.focusedRow = rows[nextIndex]
    }

    private func 激活当前键盘行() {
        let row = focusedRow
            ?? model.exactMatch.map { .category($0.id) }
            ?? (model.canCreate ? .create : nil)

        switch row {
        case .ai:
            使用AI判断()
        case let .category(categoryID):
            guard let category = keyboardCategories.first(where: { $0.id == categoryID }) else {
                return
            }
            选择已有分类(category)
        case .create:
            创建并分类()
        case nil:
            break
        }
    }

    private func 选择已有分类(_ category: ArticleCategory) {
        guard !isBusy, category.id != model.selectedCategoryID else { return }
        Task { @MainActor in
            if await model.selectExisting(category, assign: onSelectCategory) {
                onDismiss()
            }
        }
    }

    private func 创建并分类() {
        guard model.canCreate, !isBusy else { return }
        Task { @MainActor in
            if await model.createAndAssign(assign: onSelectCategory) {
                onDismiss()
            }
        }
    }

    private func 使用现有分类建议() {
        guard !isBusy else { return }
        Task { @MainActor in
            if await model.useExistingCategory(assign: onSelectCategory) {
                onDismiss()
            }
        }
    }

    private func 使用AI判断() {
        guard !isBusy else { return }
        Task { @MainActor in
            if await model.assignWithAI(assign: onSelectAI) {
                onDismiss()
            }
        }
    }

    private func dismissIfPossible() {
        guard canDismiss else { return }
        onDismiss()
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
