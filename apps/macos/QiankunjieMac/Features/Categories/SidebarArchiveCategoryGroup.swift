import Foundation
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct SidebarArchiveCategoryGroup: View {
    @Bindable var model: AppModel
    @Binding var isExpanded: Bool
    @Environment(\.colorScheme) private var colorScheme
    @State private var isQuickCreatePresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            archiveRow

            if model.isAuthenticated, isExpanded {
                categoryContent
            }
        }
        .sheet(isPresented: $isQuickCreatePresented) {
            CategoryQuickCreateView(
                catalog: model.categoryCatalog,
                onSubmit: model.createCategory,
                onCancel: {
                    isQuickCreatePresented = false
                },
                onCreated: { category in
                    model.selectCategory(category.id)
                    if model.selectedCategoryID == category.id {
                        isQuickCreatePresented = false
                    } else {
                        model.categoryCatalog.presentError(
                            "分类已创建，但无法进入该分类，请稍后重试"
                        )
                    }
                }
            )
        }
    }

    private var archiveRow: some View {
        HStack(spacing: 4) {
            if model.isAuthenticated {
                Button {
                    withAnimation(.easeOut(duration: 0.16)) {
                        isExpanded.toggle()
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 18, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(isExpanded ? "收起归档分类" : "展开归档分类")
                .accessibilityLabel(isExpanded ? "收起归档分类" : "展开归档分类")
            } else {
                Color.clear
                    .frame(width: 18, height: 24)
            }

            Button {
                model.selectDestination(.archive)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: AppDestination.archive.selectedSystemImage(
                        isSelected: isArchiveSelected
                    ))
                        .frame(width: 18)

                    Text(AppDestination.archive.title)
                        .lineLimit(1)

                    Spacer(minLength: 0)

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
            .buttonStyle(.plain)
            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
            .accessibilityLabel("打开全部归档")
        }
        .padding(.vertical, 2)
        .background {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isArchiveSelected ? selectionFill : Color.clear)
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
            if model.categoryCatalog.isLoading {
                statusRow {
                    ProgressView()
                        .controlSize(.mini)
                    Text("正在更新分类…")
                }
            } else if let errorMessage = model.categoryCatalog.errorMessage {
                failureRow(errorMessage)
            }

            ForEach(model.categoryCatalog.activeCategories, id: \.id) { category in
                categoryRow(category)
            }
        }

        quickCreateRow
        managementRow
    }

    private func categoryRow(_ category: ArticleCategory) -> some View {
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
        .buttonStyle(.plain)
        .help("查看分类：\(category.name)")
        .accessibilityLabel("\(category.name)，\(model.categoryCatalog.count(for: category.id)) 篇文章")
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
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
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
            .buttonStyle(.plain)
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

    private var selectionFill: Color {
        QiankunjieColors.accent(for: colorScheme).opacity(0.12)
    }

    private var categoryFallbackColor: Color {
        QiankunjieColors.accent(for: colorScheme)
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
