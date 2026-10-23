import Foundation
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI
import UniformTypeIdentifiers

struct SidebarArchiveCategoryGroup: View {
    @Bindable var model: AppModel
    @Binding var isExpanded: Bool
    @Environment(\.colorScheme) private var colorScheme
    @State private var isQuickCreatePresented = false
    @State private var draggedCategoryID: Int?
    @State private var weakNoticeMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            archiveRow

            if model.isAuthenticated, isExpanded {
                categoryContent
            }
        }
        .selectionDisabled()
        .listRowBackground(Color.clear)
        .statusToast(message: $weakNoticeMessage)
        .sheet(isPresented: $isQuickCreatePresented) {
            CategoryQuickCreateView(
                catalog: model.categoryCatalog,
                onSubmit: model.createCategory,
                onCancel: {
                    isQuickCreatePresented = false
                },
                onCreated: { category in
                    weakNoticeMessage = "分类「\(category.name)」已创建"
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
        Button(action: toggleArchiveRow) {
            HStack(spacing: 8) {
                Image(systemName: AppDestination.archive.selectedSystemImage(
                    isSelected: isArchiveSelected
                ))
                    .frame(width: 18)

                Text(AppDestination.archive.title)
                    .lineLimit(1)

                if model.isAuthenticated {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 14, height: 18)
                        .contentShape(Rectangle())
                }

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
        .help(model.isAuthenticated ? (isExpanded ? "收起归档分类" : "展开归档分类") : "打开全部归档")
        .accessibilityLabel(
            model.isAuthenticated
                ? (isExpanded ? "收起归档分类" : "展开归档分类")
                : "打开全部归档"
        )
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
            .animation(.snappy(duration: 0.22), value: activeCategoryIDs)
        }

        quickCreateRow
        managementRow
    }

    @ViewBuilder
    private func categoryRow(_ category: ArticleCategory) -> some View {
        if category.isSystem {
            categoryRowContent(category)
                .onDrop(of: [UTType.text], delegate: categoryDropDelegate(for: category))
        } else {
            categoryRowContent(category)
                .onDrag {
                    draggedCategoryID = category.id
                    return NSItemProvider(object: String(category.id) as NSString)
                }
                .onDrop(of: [UTType.text], delegate: categoryDropDelegate(for: category))
        }
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
        .buttonStyle(.plain)
        .help("查看分类：\(category.name)")
        .accessibilityLabel("\(category.name)，\(model.categoryCatalog.count(for: category.id)) 篇文章")
    }

    private func categoryDropDelegate(for category: ArticleCategory) -> SidebarCategoryReorderDropDelegate {
        SidebarCategoryReorderDropDelegate(
            targetCategoryID: category.id,
            targetIsSystem: category.isSystem,
            draggedCategoryID: $draggedCategoryID
        ) { movingCategoryID, targetCategoryID in
            Task {
                try? await model.categoryCatalog.reorder(
                    moving: movingCategoryID,
                    to: targetCategoryID
                )
            }
        }
    }

    private func toggleArchiveRow() {
        if !isArchiveSelected {
            model.selectCategory(nil)
        }
        guard model.isAuthenticated else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            isExpanded.toggle()
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

private struct SidebarCategoryReorderDropDelegate: DropDelegate {
    let targetCategoryID: Int
    let targetIsSystem: Bool
    @Binding var draggedCategoryID: Int?
    let onMove: (Int, Int) -> Void

    func dropUpdated(info: DropInfo) -> DropProposal? {
        guard
            let draggedCategoryID,
            draggedCategoryID != targetCategoryID,
            !targetIsSystem
        else {
            return DropProposal(operation: .forbidden)
        }
        return DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        defer { draggedCategoryID = nil }
        guard
            let draggedCategoryID,
            draggedCategoryID != targetCategoryID,
            !targetIsSystem
        else {
            return false
        }
        onMove(draggedCategoryID, targetCategoryID)
        return true
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
