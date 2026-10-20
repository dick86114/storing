import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct BulkCategoryRequest: Identifiable {
    let purpose: BulkCategoryPurpose
    let targetArticleID: Int?

    var id: String {
        "\(purpose.rawValue)-\(targetArticleID.map(String.init) ?? "bulk")"
    }
}

enum BulkCategoryPurpose: String, Identifiable {
    case archive
    case setCategory

    var id: String { rawValue }

    var title: String {
        switch self {
        case .archive: "归档到哪里？"
        case .setCategory: "批量修改分类"
        }
    }

    var subtitle: String {
        switch self {
        case .archive: "分类只用于归档文章。选择分类后，文章会移入「归档」；也可以让 AI 判断。"
        case .setCategory: "选择预设分类，或让 AI 重新判断。"
        }
    }
}

/// 批量归档与批量分类共用同一个选择器，保证「由 AI 判断」入口始终可用。
struct BulkCategorySelectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    let model: LibraryModel
    let request: BulkCategoryRequest

    private var purpose: BulkCategoryPurpose { request.purpose }
    private var targetCount: Int {
        request.targetArticleID == nil ? model.bulkSelection.count : 1
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    aiCategoryButton
                    if model.availableCategories.isEmpty {
                        Text("暂无可用分类")
                            .qiankunjieFont(.bodyMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .padding(.vertical, 18)
                    } else {
                        ForEach(model.availableCategories) { category in
                            categoryButton(category)
                        }
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(width: 440, height: 430)
        .background(QiankunjieColors.surface(for: colorScheme))
        .task {
            await model.loadAvailableCategories()
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(purpose.title)
                    .qiankunjieFont(.titleMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Text("已选 \(targetCount) 篇。\(purpose.subtitle)")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("关闭分类选择")
        }
        .padding(16)
    }

    private var aiCategoryButton: some View {
        Button {
            Task {
                if let articleID = request.targetArticleID {
                    switch purpose {
                    case .archive:
                        await model.runArticleToolbarAction(.archive, articleID: articleID)
                    case .setCategory:
                        await model.runArticleCategoryByAI(articleID: articleID)
                    }
                } else {
                    switch purpose {
                    case .archive:
                        await model.runBulkToolbarAction(.archive)
                    case .setCategory:
                        await model.runBulkCategoryByAI()
                    }
                }
                dismiss()
            }
        } label: {
            HStack(spacing: 9) {
                Image(systemName: "sparkles")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                VStack(alignment: .leading, spacing: 2) {
                    Text("由 AI 判断")
                        .qiankunjieFont(.bodyMedium)
                    Text("低置信度会进入待整理")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(QiankunjieColors.accent(for: colorScheme).opacity(0.12))
            }
        }
        .buttonStyle(.plain)
        .disabled(model.bulkRunningAction != nil)
        .accessibilityLabel("由 AI 判断分类")
    }

    private func categoryButton(_ category: LibraryCategoryFilter) -> some View {
        Button {
            Task {
                if let articleID = request.targetArticleID {
                    switch purpose {
                    case .archive:
                        await model.runArticleToolbarAction(
                            .archive,
                            articleID: articleID,
                            categoryID: category.id
                        )
                    case .setCategory:
                        await model.runArticleCategory(
                            articleID: articleID,
                            categoryID: category.id
                        )
                    }
                } else {
                    switch purpose {
                    case .archive:
                        await model.runBulkToolbarAction(.archive, categoryID: category.id)
                    case .setCategory:
                        await model.runBulkCategory(category.id)
                    }
                }
                dismiss()
            }
        } label: {
            HStack(spacing: 9) {
                Circle()
                    .fill(Color(hexString: category.color) ?? QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 9, height: 9)
                Text(category.name)
                    .qiankunjieFont(.bodyMedium)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.45))
            }
        }
        .buttonStyle(.plain)
        .disabled(model.bulkRunningAction != nil)
        .accessibilityLabel("设置分类 \(category.name)")
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
