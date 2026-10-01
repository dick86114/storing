import Observation
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

extension ArticleCategory: @retroactive Identifiable {}

struct CategoryDraft: Sendable {
    var name = ""
    var description = ""
    var includeExamples: [String] = []
    var excludeExamples: [String] = []
    var color = categoryPresetColors[0]

    init() {}

    init(category: ArticleCategory) {
        name = category.name
        description = category.articleDescription ?? ""
        includeExamples = category.includeExamples
        excludeExamples = category.excludeExamples
        color = category.color ?? categoryPresetColors[0]
    }
}

let categoryPresetColors = [
    "#2F6A4F", "#3E7C83", "#536CCB", "#8A5A9E", "#B36A45", "#A67C38",
    "#647B4D", "#2F7780", "#6675B7", "#A16078", "#9B7250", "#6B7088",
]

@MainActor
@Observable
final class CategoryManagementModel {
    let client: ManagementAPIClient
    private(set) var categories: [ArticleCategory] = []
    private(set) var counts: [String: Int] = [:]
    private(set) var isLoading = false
    private(set) var isSaving = false
    var errorMessage: String?
    var noticeMessage: String?
    var editingCategory: ArticleCategory?
    var deletingCategory: ArticleCategory?
    var isCreating = false

    init(client: ManagementAPIClient) {
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: CategoriesResponse = try await client.get(
                "categories",
                queryItems: [URLQueryItem(name: "includeInactive", value: "true")]
            )
            categories = response.categories
            counts = response.counts
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func save(_ draft: CategoryDraft, editing category: ArticleCategory?) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let request = CategoryMutationRequest(
                name: draft.name.trimmingCharacters(in: .whitespacesAndNewlines),
                description: draft.description.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                includeExamples: draft.includeExamples,
                excludeExamples: draft.excludeExamples,
                color: draft.color,
                isActive: nil
            )

            if let category {
                let _: CategoryResponse = try await client.send(
                    "categories/\(category.id)",
                    method: .patch,
                    body: request
                )
                noticeMessage = "分类已更新"
                editingCategory = nil
            } else {
                let _: CategoryResponse = try await client.send(
                    "categories",
                    method: .post,
                    body: request
                )
                noticeMessage = "分类已创建"
                isCreating = false
            }
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func setActive(_ category: ArticleCategory, isActive: Bool) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let request = CategoryMutationRequest(
                name: nil,
                description: nil,
                includeExamples: nil,
                excludeExamples: nil,
                color: nil,
                isActive: isActive
            )
            let _: CategoryResponse = try await client.send(
                "categories/\(category.id)",
                method: .patch,
                body: request
            )
            noticeMessage = isActive ? "分类已重新启用" : "分类已停用"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func move(_ category: ArticleCategory, offset: Int) async {
        guard
            let sourceIndex = categories.firstIndex(where: { $0.id == category.id })
        else {
            return
        }
        let targetIndex = sourceIndex + offset
        guard categories.indices.contains(targetIndex) else {
            return
        }

        var categoryIDs = categories.map(\.id)
        categoryIDs.swapAt(sourceIndex, targetIndex)
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        struct ReorderRequest: Encodable, Sendable {
            let categoryIDs: [Int]

            enum CodingKeys: String, CodingKey {
                case categoryIDs = "categoryIds"
            }
        }

        do {
            let _: CategoryReorderResponse = try await client.send(
                "categories/reorder",
                method: .post,
                body: ReorderRequest(categoryIDs: categoryIDs)
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func delete(_ category: ArticleCategory, targetCategoryID: Int) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let response: DeleteCategoryResponse = try await client.delete(
                "categories/\(category.id)",
                queryItems: [URLQueryItem(name: "targetCategoryId", value: String(targetCategoryID))]
            )
            deletingCategory = nil
            noticeMessage = "分类已删除，已迁移 \(response.movedArticleCount) 篇文章"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func optimize(_ draft: CategoryDraft) async -> CategoryDraft? {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let response: CategoryOptimizeResponse = try await client.send(
                "categories/optimize-description",
                method: .post,
                body: CategoryOptimizeRequest(
                    name: draft.name.trimmingCharacters(in: .whitespacesAndNewlines),
                    description: draft.description.nilIfEmpty,
                    includeExamples: draft.includeExamples,
                    excludeExamples: draft.excludeExamples
                )
            )
            var optimized = draft
            if let description = response.draft.description, !description.isEmpty {
                optimized.description = description
            }
            if let examples = response.draft.includeExamples, !examples.isEmpty {
                optimized.includeExamples = examples
            }
            if let examples = response.draft.excludeExamples, !examples.isEmpty {
                optimized.excludeExamples = examples
            }
            noticeMessage = "已生成分类规则草案"
            return optimized
        } catch {
            errorMessage = managementErrorMessage(for: error)
            return nil
        }
    }
}

struct CategoryManagementView: View {
    @State private var model: CategoryManagementModel
    @Environment(\.colorScheme) private var colorScheme

    init(client: ManagementAPIClient) {
        _model = State(initialValue: CategoryManagementModel(client: client))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            if model.isLoading && model.categories.isEmpty {
                ProgressView("正在加载分类…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                content
            }
        }
        .frame(minWidth: 880, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
        .task {
            await model.load()
        }
        .sheet(isPresented: $model.isCreating) {
            CategoryEditorSheet(model: model, category: nil)
        }
        .sheet(item: $model.editingCategory) { category in
            CategoryEditorSheet(model: model, category: category)
        }
        .sheet(item: $model.deletingCategory) { category in
            CategoryDeleteSheet(model: model, category: category)
        }
        .alert(
            "分类操作失败",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("关闭", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("分类管理")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                Text("分类决定归档文章的长期归属，AI 只会从这里选择，不会自行创建分类。")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            Spacer()
            Button {
                Task { await model.load() }
            } label: {
                Label("刷新", systemImage: "arrow.clockwise")
            }
            .disabled(model.isLoading)
            Button {
                model.isCreating = true
            } label: {
                Label("新增分类", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.isSaving)
        }
        .padding(20)
    }

    private func inlineNotice(_ message: String, isError: Bool) -> some View {
        Text(message)
            .font(.callout)
            .foregroundStyle(isError ? .red : .green)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background((isError ? Color.red : Color.green).opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let notice = model.noticeMessage {
                    inlineNotice(notice, isError: false)
                }

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 320, maximum: .infinity), spacing: 12)],
                    alignment: .leading,
                    spacing: 12
                ) {
                    ForEach(Array(model.categories.enumerated()), id: \.element.id) { index, category in
                        CategoryCard(
                            category: category,
                            articleCount: model.counts[String(category.id)] ?? 0,
                            canMoveUp: index > 0,
                            canMoveDown: index < model.categories.count - 1,
                            canDelete: model.categories.contains {
                                $0.id != category.id && $0.isActive && !$0.isSystem
                            },
                            isBusy: model.isSaving,
                            onMoveUp: { Task { await model.move(category, offset: -1) } },
                            onMoveDown: { Task { await model.move(category, offset: 1) } },
                            onEdit: { model.editingCategory = category },
                            onToggle: {
                                Task { await model.setActive(category, isActive: !category.isActive) }
                            },
                            onDelete: { model.deletingCategory = category }
                        )
                    }
                }
            }
            .padding(20)
        }
    }
}

private struct CategoryCard: View {
    let category: ArticleCategory
    let articleCount: Int
    let canMoveUp: Bool
    let canMoveDown: Bool
    let canDelete: Bool
    let isBusy: Bool
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void
    let onEdit: () -> Void
    let onToggle: () -> Void
    let onDelete: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Circle()
                    .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 10, height: 10)
                    .padding(.top, 5)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text(category.name)
                            .font(.headline)
                            .lineLimit(1)
                        if category.isSystem {
                            badge("系统")
                        }
                        if !category.isActive {
                            badge("已停用", color: .orange)
                        }
                    }

                    Text(category.articleDescription?.nilIfEmpty ?? "尚未设置分类说明。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .lineLimit(2)
                        .frame(minHeight: 36, alignment: .topLeading)
                }

                Spacer(minLength: 8)
            }

            HStack(alignment: .top, spacing: 18) {
                rule("适合", category.includeExamples)
                rule("排除", category.excludeExamples)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            HStack(spacing: 6) {
                Label("\(articleCount) 篇", systemImage: "folder")
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                Spacer(minLength: 8)

                cardAction("arrow.up", label: "上移", enabled: canMoveUp && !isBusy, action: onMoveUp)
                cardAction("arrow.down", label: "下移", enabled: canMoveDown && !isBusy, action: onMoveDown)
                if !category.isSystem {
                    cardAction("pencil", label: "编辑", enabled: !isBusy, action: onEdit)
                    cardAction(
                        category.isActive ? "pause" : "play",
                        label: category.isActive ? "停用" : "重新启用",
                        enabled: !isBusy,
                        action: onToggle
                    )
                    cardAction("trash", label: "删除", enabled: canDelete && !isBusy, destructive: true, action: onDelete)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                .frame(width: 4)
                .padding(.vertical, 12)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if !category.isSystem && !isBusy {
                onEdit()
            }
        }
    }

    private func cardAction(
        _ systemImage: String,
        label: String,
        enabled: Bool,
        destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: destructive ? .destructive : nil, action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .medium))
                .frame(width: 26, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .disabled(!enabled)
        .help(label)
        .accessibilityLabel(label)
    }

    private func badge(_ text: String, color: Color = .secondary) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(color.opacity(0.1), in: Capsule())
    }

    private func rule(_ title: String, _ examples: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            Text(examples.isEmpty ? "尚未定义" : examples.prefix(2).joined(separator: "、"))
                .font(.caption)
                .lineLimit(1)
        }
    }
}

private struct CategoryEditorSheet: View {
    let model: CategoryManagementModel
    let category: ArticleCategory?
    @Environment(\.dismiss) private var dismiss
    @State private var draft: CategoryDraft

    init(model: CategoryManagementModel, category: ArticleCategory?) {
        self.model = model
        self.category = category
        _draft = State(initialValue: category.map(CategoryDraft.init(category:)) ?? CategoryDraft())
    }

    var body: some View {
        Form {
            Section("分类信息") {
                TextField("分类名称", text: $draft.name)
                TextField("分类说明", text: $draft.description, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section {
                TextEditor(text: Binding(
                    get: { draft.includeExamples.joined(separator: "\n") },
                    set: { draft.includeExamples = $0.lines }
                ))
                .frame(minHeight: 90)
            } header: {
                Text("适合收录")
            } footer: {
                Text("每行一个典型主题、文章类型或问题场景。")
            }

            Section {
                TextEditor(text: Binding(
                    get: { draft.excludeExamples.joined(separator: "\n") },
                    set: { draft.excludeExamples = $0.lines }
                ))
                .frame(minHeight: 90)
            } header: {
                Text("不适合收录")
            } footer: {
                Text("每行一个容易混淆、但应归入其他分类的内容。")
            }

            Section("显示颜色") {
                LazyVGrid(columns: Array(repeating: GridItem(.fixed(32)), count: 12), spacing: 10) {
                    ForEach(categoryPresetColors, id: \.self) { color in
                        Button {
                            draft.color = color
                        } label: {
                            Circle()
                                .fill(Color(hexString: color) ?? .accentColor)
                                .frame(width: 26, height: 26)
                                .overlay {
                                    if draft.color == color {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(.white)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 560, height: 620)
        .navigationTitle(category == nil ? "新增分类" : "编辑分类")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItemGroup(placement: .confirmationAction) {
                Button("AI 优化") {
                    Task {
                        if let optimized = await model.optimize(draft) {
                            draft = optimized
                        }
                    }
                }
                .disabled(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isSaving)

                Button(model.isSaving ? "保存中…" : "保存") {
                    Task { await model.save(draft, editing: category) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isSaving)
            }
        }
    }
}

private struct CategoryDeleteSheet: View {
    let model: CategoryManagementModel
    let category: ArticleCategory
    @Environment(\.dismiss) private var dismiss
    @State private var targetID: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("删除“\(category.name)”", systemImage: "trash")
                .font(.title2.weight(.semibold))
            Text("删除前请选择接收现有归档文章的目标分类。")
                .foregroundStyle(.secondary)
            Picker("文章迁移到", selection: $targetID) {
                Text("请选择").tag(Int?.none)
                ForEach(availableTargets) { item in
                    Text(item.name).tag(Optional(item.id))
                }
            }
            HStack {
                Button("取消") { dismiss() }
                Spacer()
                Button(model.isSaving ? "正在删除…" : "迁移并删除", role: .destructive) {
                    guard let targetID else { return }
                    Task { await model.delete(category, targetCategoryID: targetID) }
                }
                .disabled(targetID == nil || model.isSaving)
            }
        }
        .padding(24)
        .frame(width: 460)
        .onAppear {
            targetID = availableTargets.first?.id
        }
    }

    private var availableTargets: [ArticleCategory] {
        model.categories.filter {
            $0.id != category.id && $0.isActive && !$0.isSystem
        }
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

private extension String {
    var lines: [String] {
        split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
