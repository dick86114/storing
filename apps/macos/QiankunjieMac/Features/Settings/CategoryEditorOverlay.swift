import AppKit
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct CategoryEditorOverlay: View {
    let model: CategoryManagementModel
    let category: ArticleCategory?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var draft: CategoryDraft

    init(model: CategoryManagementModel, category: ArticleCategory?) {
        self.model = model
        self.category = category
        _draft = State(initialValue: category.map(CategoryDraft.init(category:)) ?? CategoryDraft())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                VStack(alignment: .leading, spacing: 8) {
                    Text("分类名称").font(.headline)
                    TextField("例如：编程开发", text: $draft.name)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("分类说明").font(.headline)
                        Spacer()
                        Button {
                            Task {
                                if let optimized = await model.optimize(draft) {
                                    draft = optimized
                                }
                            }
                        } label: {
                            Label("AI 优化", systemImage: "wand.and.stars")
                        }
                        .disabled(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isSaving)
                    }
                    TextField(
                        "用一句话说明这个分类的长期归属边界。",
                        text: $draft.description,
                        axis: .vertical
                    )
                    .lineLimit(3...5)
                    .textFieldStyle(.roundedBorder)
                }

                HStack(alignment: .top, spacing: 16) {
                    ruleEditor(
                        title: "适合收录",
                        footer: "写典型主题、文章类型或问题场景，每行一个。",
                        examples: $draft.includeExamples
                    )
                    ruleEditor(
                        title: "不适合收录",
                        footer: "写容易混淆但应归到其他分类的内容，每行一个。",
                        examples: $draft.excludeExamples
                    )
                }

                Divider()
                colorSection
                Divider()

                HStack {
                    Spacer()
                    Button("取消") { dismiss() }
                        .disabled(model.isSaving)
                    Button(model.isSaving ? "保存中…" : category == nil ? "创建分类" : "保存修改") {
                        Task { await model.save(draft, editing: category) }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isSaving)
                }
            }
            .padding(28)
        }
        .frame(width: 780, height: 680)
        .background(QiankunjieColors.surface(for: colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .navigationTitle(category == nil ? "新增分类" : "编辑分类")
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 7) {
                Text(category == nil ? "建立归档边界" : "调整归档规则")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                Text(category == nil ? "新增分类" : "编辑分类")
                    .font(.title.weight(.semibold))
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.bordered)
            .help("关闭")
            .accessibilityLabel("关闭分类编辑器")
        }
    }

    private var colorSection: some View {
        HStack(alignment: .center, spacing: 20) {
            VStack(alignment: .leading, spacing: 5) {
                Text("显示颜色").font(.headline)
                Text("用于归档导航和文章分类标识。")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            Spacer()
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(28)), count: 6), spacing: 10) {
                ForEach(categoryPresetColors, id: \.self) { color in
                    Button {
                        draft.color = color
                    } label: {
                        colorSwatch(color, isSelected: draft.color == color)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("选择颜色 \(color)")
                }
            }
            ColorPicker(selection: Binding(
                get: { color(fromHex: draft.color) ?? QiankunjieColors.accent(for: colorScheme) },
                set: { draft.color = hexString(from: $0) ?? categoryPresetColors[0] }
            )) {
                Label("调色盘", systemImage: "paintpalette")
            }
        }
    }

    private func ruleEditor(
        title: String,
        footer: String,
        examples: Binding<[String]>
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            TextEditor(text: Binding(
                get: { examples.wrappedValue.joined(separator: "\n") },
                set: { examples.wrappedValue = parseExamples($0) }
            ))
            .frame(minHeight: 108)
            .scrollContentBackground(.hidden)
            .padding(6)
            .background(QiankunjieColors.surfaceVariant(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
            Text(footer)
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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

    private func parseExamples(_ value: String) -> [String] {
        value
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func color(fromHex value: String) -> Color? {
        let cleaned = value.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard cleaned.count == 6, let hex = UInt32(cleaned, radix: 16) else { return nil }
        return Color(hex: hex)
    }

    private func colorSwatch(_ hex: String, isSelected: Bool) -> some View {
        let fillColor = color(fromHex: hex) ?? QiankunjieColors.accent(for: colorScheme)
        let selectedColor = WorkspacePalette.primary(for: colorScheme)

        return ZStack {
            Circle()
                .fill(fillColor)
                .frame(width: 22, height: 22)
            if isSelected {
                Circle()
                    .strokeBorder(selectedColor, lineWidth: 2)
                    .frame(width: 28, height: 28)
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
    }
}
