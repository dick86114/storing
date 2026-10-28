import QiankunjieDesignSystem
import SwiftUI

/// 工作台左侧菜单的一个条目。
/// `ID` 使用 Hashable，方便设置页和管理员页复用同一套左右布局。
struct WorkspaceSidebarItem<ID: Hashable>: Identifiable {
    let id: ID
    let title: String
    let systemImage: String
    var subtitle: String?

    init(id: ID, title: String, systemImage: String, subtitle: String? = nil) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.subtitle = subtitle
    }
}

/// 设置类页面的左侧工作台菜单。
/// 视觉上与分类管理保持一致：表面色卡片、描边、强调色选中态。
struct WorkspaceSidebar<ID: Hashable>: View {
    let sectionTitle: String
    let items: [WorkspaceSidebarItem<ID>]
    @Binding var selection: ID
    var width: CGFloat = 236
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(sectionTitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .padding(.leading, 2)

                ForEach(items) { item in
                    itemButton(item)
                }
            }
            .padding(16)
        }
        .frame(width: width)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private func itemButton(_ item: WorkspaceSidebarItem<ID>) -> some View {
        let isSelected = selection == item.id

        return Button {
            selection = item.id
        } label: {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: item.systemImage)
                    .font(.system(size: 13, weight: .medium))
                    .frame(width: 26, height: 26)
                    .background(
                        (isSelected
                            ? WorkspacePalette.primary(for: colorScheme)
                            : QiankunjieColors.surfaceVariant(for: colorScheme)).opacity(isSelected ? 0.18 : 0.6),
                        in: RoundedRectangle(cornerRadius: 8)
                    )
                    .foregroundStyle(
                        isSelected
                            ? WorkspacePalette.primary(for: colorScheme)
                            : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.callout.weight(isSelected ? .semibold : .regular))
                        .lineLimit(1)

                    if let subtitle = item.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isSelected
                    ? WorkspacePalette.primary(for: colorScheme).opacity(0.12)
                    : QiankunjieColors.surface(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        isSelected
                            ? WorkspacePalette.primary(for: colorScheme).opacity(0.45)
                            : QiankunjieColors.outline(for: colorScheme)
                    )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// 设置类页面右侧的内容分组卡片。
struct WorkspacePanel<Content: View, HeaderAccessory: View>: View {
    let title: String
    var subtitle: String?
    var systemImage: String?
    @ViewBuilder let headerAccessory: () -> HeaderAccessory
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme

    init(
        title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        @ViewBuilder headerAccessory: @escaping () -> HeaderAccessory,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.headerAccessory = headerAccessory
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 10) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                        .frame(width: 24)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                    if let subtitle {
                        Text(subtitle)
                            .font(.callout)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }

                Spacer(minLength: 12)
                headerAccessory()
            }

            Divider()
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }
}

extension WorkspacePanel where HeaderAccessory == EmptyView {
    init(
        title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.init(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            headerAccessory: { EmptyView() },
            content: content
        )
    }
}

/// 设置类页面统一的内容容器：整页滚动 + 卡片间距 + 页面留白。
struct SettingsPage<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                content()
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(QiankunjieColors.background(for: colorScheme))
    }
}

/// 设置页统一的一行：左侧标题（可带说明），右侧控件。
struct SettingsRow<Content: View>: View {
    let title: String
    var subtitle: String?
    /// 右侧控件宽度，四个页面统一取值，保证列对齐。
    var controlWidth: CGFloat = 360
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme

    init(
        title: String,
        subtitle: String? = nil,
        controlWidth: CGFloat = 360,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.controlWidth = controlWidth
        self.content = content
    }

    var body: some View {
        HStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                if let subtitle {
                    Text(subtitle)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 12)

            content()
                .frame(width: controlWidth, alignment: .trailing)
        }
    }
}

/// 设置页统一的整块内容行：标题与说明在上，控件占满整行。
struct SettingsBlockRow<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme

    init(
        title: String,
        subtitle: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                if let subtitle {
                    Text(subtitle)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// 设置页统一的行间分隔线。
struct SettingsRowDivider: View {
    var body: some View {
        Divider()
            .padding(.vertical, 2)
    }
}

/// 设置页统一的操作行：右侧对齐的按钮组。
struct SettingsActionsRow<Content: View>: View {
    @ViewBuilder let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}
