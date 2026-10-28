import AppKit
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct CategoryQuickCreateView: View {
    private enum 焦点字段: Hashable {
        case name
        case description
    }

    @Bindable var catalog: CategoryCatalogModel
    let primaryActionTitle: String
    let onCancel: () -> Void
    let onCompleted: @MainActor (CategoryQuickCreateResult) async -> Void

    @Environment(\.colorScheme) private var colorScheme
    @State private var model: CategoryQuickCreateModel
    @State private var showsDetails = false
    @State private var hasChosenColor = false
    @FocusState private var focusedField: 焦点字段?

    init(
        catalog: CategoryCatalogModel,
        initialName: String = "",
        primaryActionTitle: String = "创建分类",
        onCancel: @escaping () -> Void,
        onCompleted: @escaping @MainActor (CategoryQuickCreateResult) async -> Void
    ) {
        self.catalog = catalog
        self.primaryActionTitle = primaryActionTitle
        self.onCancel = onCancel
        self.onCompleted = onCompleted
        _model = State(initialValue: CategoryQuickCreateModel(
            catalog: catalog,
            initialName: initialName
        ))
    }

    init(
        catalog: CategoryCatalogModel,
        initialName: String = "",
        primaryActionTitle: String = "创建分类",
        onSubmit: @escaping @MainActor (CategoryDraft) async throws -> ArticleCategory,
        onCancel: @escaping () -> Void,
        onCompleted: @escaping @MainActor (CategoryQuickCreateResult) async -> Void
    ) {
        self.catalog = catalog
        self.primaryActionTitle = primaryActionTitle
        self.onCancel = onCancel
        self.onCompleted = onCompleted
        _model = State(initialValue: CategoryQuickCreateModel(
            catalog: catalog,
            initialName: initialName
        ))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                nameField
                sameNameSuggestion
                detailsToggle

                if showsDetails {
                    advancedRules
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                statusMessage
                actionBar
            }
            .padding(24)
        }
        .frame(
            minWidth: 500,
            idealWidth: 540,
            maxWidth: 600,
            minHeight: 230,
            idealHeight: showsDetails ? 650 : 280,
            maxHeight: 760
        )
        .background(QiankunjieColors.surface(for: colorScheme))
        .onAppear {
            focusedField = .name
        }
        .onChange(of: showsDetails) { _, isExpanded in
            guard isExpanded else { return }
            Task { @MainActor in
                await Task.yield()
                focusedField = .description
            }
        }
        .onChange(of: model.draft.name) {
            model.clearLocalError()
            guard !hasChosenColor else { return }
            model.draft.color = CategoryQuickCreatePolicy.suggestedColor(
                for: model.draft.name,
                existingColors: catalog.activeCategories.compactMap(\.color)
            )
        }
        .onChange(of: catalog.userID) {
            guard model.isStaleForCurrentUser else { return }
            model.handleUserChanged()
            onCancel()
        }
        .onKeyPress(.escape) {
            取消()
            return .handled
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("新建分类")
                .font(.title2.weight(.semibold))
            Text("名称是唯一必填项，其余规则可以稍后补充。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("分类名称")
                .font(.headline)
            TextField("例如：产品设计", text: $model.draft.name)
                .textFieldStyle(.roundedBorder)
                .focused($focusedField, equals: .name)
                .disabled(isInteractionDisabled)
                .accessibilityLabel("分类名称")
                .onSubmit {
                    guard canSubmit else { return }
                    开始提交()
                }
        }
    }

    @ViewBuilder
    private var sameNameSuggestion: some View {
        if let suggestion = model.conflictSuggestion ?? model.sameNameSuggestion {
            Button {
                Task { @MainActor in
                    await 使用现有分类()
                }
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "arrow.turn.down.right")
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("已存在同名分类")
                            .font(.callout.weight(.medium))
                        Text("使用现有分类「\(suggestion.name)」")
                            .font(.callout)
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
            .disabled(isInteractionDisabled)
            .accessibilityLabel("使用现有分类 \(suggestion.name)")
        }
    }

    private var detailsToggle: some View {
        Button {
            withAnimation(.easeOut(duration: 0.16)) {
                showsDetails.toggle()
            }
        } label: {
            HStack(spacing: 7) {
                Text("详细规则（可选）")
                    .font(.callout.weight(.medium))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .rotationEffect(.degrees(showsDetails ? 90 : 0))
            }
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .disabled(isInteractionDisabled)
        .accessibilityLabel(showsDetails ? "收起详细规则" : "展开详细规则")
    }

    private var advancedRules: some View {
        VStack(alignment: .leading, spacing: 16) {
            Divider()
            descriptionEditor

            HStack(alignment: .top, spacing: 14) {
                ruleEditor(
                    title: "适合收录",
                    placeholder: "例如：产品设计方法\n例如：用户体验案例",
                    examples: $model.draft.includeExamples
                )
                ruleEditor(
                    title: "不适合收录",
                    placeholder: "例如：纯新闻快讯\n例如：临时活动通知",
                    examples: $model.draft.excludeExamples
                )
            }

            colorSection
        }
    }

    private var descriptionEditor: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("分类说明")
                    .font(.headline)
                Spacer()
                Button {
                    Task { await optimizeDraft() }
                } label: {
                    if catalog.isMutating {
                        HStack(spacing: 5) {
                            ProgressView()
                                .controlSize(.mini)
                            Text("优化中…")
                        }
                    } else {
                        Label("AI 优化", systemImage: "wand.and.stars")
                    }
                }
                .disabled(isInteractionDisabled || normalizedName.isEmpty)
                .accessibilityLabel("AI 优化分类规则")
            }

            TextField(
                "说明这个分类的长期归属边界。",
                text: $model.draft.description,
                axis: .vertical
            )
            .lineLimit(3...5)
            .textFieldStyle(.roundedBorder)
            .focused($focusedField, equals: .description)
            .disabled(isInteractionDisabled)
            .accessibilityLabel("分类说明")
        }
    }

    private func ruleEditor(
        title: String,
        placeholder: String,
        examples: Binding<[String]>
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.headline)
            TextEditor(text: Binding(
                get: { examples.wrappedValue.joined(separator: "\n") },
                set: { examples.wrappedValue = parseExamples($0) }
            ))
            .font(.body)
            .scrollContentBackground(.hidden)
            .padding(5)
            .frame(minHeight: 82)
            .background(
                QiankunjieColors.surfaceVariant(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 7, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
            .overlay(alignment: .topLeading) {
                if examples.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.caption)
                        .foregroundStyle(
                            QiankunjieColors.onSurfaceVariant(for: colorScheme).opacity(0.72)
                        )
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                        .allowsHitTesting(false)
                }
            }
            .disabled(isInteractionDisabled)
            .accessibilityLabel(title)

            Text("每行一个")
                .font(.caption)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var colorSection: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("显示颜色")
                    .font(.headline)
                Text("用于归档导航和文章标识。")
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 8)

            LazyVGrid(
                columns: Array(repeating: GridItem(.fixed(24), spacing: 8), count: 6),
                spacing: 8
            ) {
                ForEach(categoryPresetColors, id: \.self) { color in
                    Button {
                        hasChosenColor = true
                        model.draft.color = color
                    } label: {
                        colorSwatch(color, isSelected: model.draft.color == color)
                    }
                    .buttonStyle(QiankunjiePlainButtonStyle())
                    .disabled(isInteractionDisabled)
                    .accessibilityLabel("选择颜色 \(color)")
                }
            }

            ColorPicker(
                selection: Binding(
                    get: {
                        color(fromHex: model.draft.color)
                            ?? QiankunjieColors.accent(for: colorScheme)
                    },
                    set: {
                        hasChosenColor = true
                        model.draft.color = hexString(from: $0) ?? categoryPresetColors[0]
                    }
                )
            ) {
                Label("调色盘", systemImage: "paintpalette")
            }
            .disabled(isInteractionDisabled)
            .accessibilityLabel("自定义分类颜色")
        }
    }

    @ViewBuilder
    private var statusMessage: some View {
        if isInitialLoading {
            HStack(spacing: 7) {
                ProgressView()
                    .controlSize(.small)
                Text("正在加载分类目录…")
            }
            .font(.callout)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        } else if let message = model.displayedErrorMessage {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(.red)
                Text(message)
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if !catalog.hasLoadedCatalog {
                    Button("重试") {
                        Task { await catalog.load() }
                    }
                    .buttonStyle(QiankunjiePlainButtonStyle())
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    .disabled(catalog.isLoading)
                    .accessibilityLabel("重新加载分类目录")
                }
            }
        } else if catalog.isLoading {
            Text("正在更新分类目录…")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        } else if catalog.hasLoadedCatalog, catalog.activeCategories.isEmpty {
            Text("还没有启用分类，保存后会进入这个新分类。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var actionBar: some View {
        HStack(spacing: 10) {
            Button("取消") {
                取消()
            }
            .keyboardShortcut(.cancelAction)
            .accessibilityLabel("取消新建分类")

            Spacer(minLength: 0)

            Button {
                开始提交()
            } label: {
                if model.isSubmitting {
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.mini)
                        Text("创建中…")
                    }
                } else {
                    Text(primaryActionTitle)
                }
            }
            .buttonStyle(.borderedProminent)
            .keyboardShortcut(.return, modifiers: [])
            .disabled(!canSubmit)
            .accessibilityLabel(primaryActionTitle)
        }
    }

    private var normalizedName: String {
        model.normalizedName
    }

    private var canSubmit: Bool {
        model.canSubmit
    }

    private var isInteractionDisabled: Bool {
        model.isInteractionDisabled
    }

    private var isInitialLoading: Bool {
        model.isInitialLoading
    }

    private func 开始提交() {
        guard let task = model.startSubmission() else { return }
        Task { @MainActor in
            guard let category = await task.value else { return }
            await onCompleted(.created(category))
        }
    }

    private func 取消() {
        model.cancel()
        onCancel()
    }

    private func 使用现有分类() async {
        guard let category = model.useExistingCategory() else { return }
        await onCompleted(.reusedExisting(category))
    }

    private func optimizeDraft() async {
        guard !isInteractionDisabled, !normalizedName.isEmpty else { return }

        model.clearLocalError()
        catalog.clearError()
        var optimizedDraft = model.draft
        optimizedDraft.name = normalizedName

        do {
            model.draft = try await catalog.optimize(optimizedDraft)
            hasChosenColor = true
            focusedField = .description
        } catch {
            if catalog.errorMessage == nil {
                model.presentLocalError(managementErrorMessage(for: error))
            }
        }
    }

    private func parseExamples(_ value: String) -> [String] {
        value
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func hexString(from color: Color) -> String? {
        guard let nsColor = NSColor(color).usingColorSpace(.sRGB) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            UInt32(round(nsColor.redComponent * 255)),
            UInt32(round(nsColor.greenComponent * 255)),
            UInt32(round(nsColor.blueComponent * 255))
        )
    }

    private func color(fromHex value: String) -> Color? {
        let cleaned = value.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard cleaned.count == 6, let hex = UInt32(cleaned, radix: 16) else {
            return nil
        }
        return Color(hex: hex)
    }

    private func colorSwatch(_ hex: String, isSelected: Bool) -> some View {
        let fillColor = color(fromHex: hex)
            ?? QiankunjieColors.accent(for: colorScheme)
        let selectedColor = QiankunjieColors.accent(for: colorScheme)

        return ZStack {
            Circle()
                .fill(fillColor)
                .frame(width: 20, height: 20)
            if isSelected {
                Circle()
                    .strokeBorder(selectedColor, lineWidth: 2)
                    .frame(width: 26, height: 26)
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 28, height: 28)
    }
}
