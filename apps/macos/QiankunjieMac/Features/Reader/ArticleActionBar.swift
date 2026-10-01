import QiankunjieDesignSystem
import QiankunjieReader
import SwiftUI

enum ReaderArticleAction: Identifiable {
    case favorite
    case archive
    case inbox
    case publish
    case unpublish
    case refetch
    case regenerateAI
    case delete
    case openOriginal(URL)

    var id: String {
        switch self {
        case .favorite: "favorite"
        case .archive: "archive"
        case .inbox: "inbox"
        case .publish: "publish"
        case .unpublish: "unpublish"
        case .refetch: "refetch"
        case .regenerateAI: "regenerate-ai"
        case .delete: "delete"
        case .openOriginal: "open-original"
        }
    }

    var confirmationTitle: String {
        switch self {
        case .archive: "归档这篇文章？"
        case .inbox: "移回收件箱？"
        case .publish: "公开这篇文章？"
        case .unpublish: "取消公开？"
        case .refetch: "重新抓取正文？"
        case .regenerateAI: "重新生成 AI 信息？"
        case .delete: "删除这篇文章？"
        case .openOriginal: "打开原始网页？"
        case .favorite: ""
        }
    }

    var confirmationMessage: String {
        switch self {
        case .archive: "文章会从当前视图移到归档。"
        case .inbox: "文章会从归档移回收件箱。"
        case .publish: "公开后游客可以访问这篇文章。"
        case .unpublish: "取消后公开链接将不可访问。"
        case .refetch: "服务端会覆盖当前正文和封面。"
        case .regenerateAI: "当前 AI 摘要和标签会被替换。"
        case .delete: "文章会从资料库中移除。"
        case .openOriginal: "网页将在默认浏览器中打开。"
        case .favorite: ""
        }
    }

    var buttonTitle: String {
        switch self {
        case .archive: "归档"
        case .inbox: "移回收件箱"
        case .publish: "公开"
        case .unpublish: "取消公开"
        case .refetch: "重新抓取"
        case .regenerateAI: "重新生成"
        case .delete: "删除"
        case .openOriginal: "打开原文"
        case .favorite: "收藏"
        }
    }

    var isDestructive: Bool {
        switch self {
        case .delete, .refetch, .regenerateAI, .unpublish:
            true
        default:
            false
        }
    }
}

struct ArticleActionBar: View {
    let model: ReaderModel
    let isGuest: Bool
    let contentWidth: ReaderContentWidthPreference
    let onContentWidthChange: (ReaderContentWidthPreference) -> Void
    let onAction: (ReaderArticleAction) -> Void
    @Environment(\.colorScheme) private var colorScheme

    private var availability: ReaderActionAvailability {
        ReaderActionPolicy.availability(
            articleID: model.articleID,
            isGuest: isGuest,
            isPerformingAction: model.isPerformingAction,
            originalURLText: model.article?.originalURL
        )
    }

    var body: some View {
        let actionAvailability = availability
        HStack(spacing: 8) {
            let accountActionsDisabled = !actionAvailability.allowsAccountActions

            actionButton(
                model.article?.isFavorited == true ? "star.fill" : "star",
                model.article?.isFavorited == true ? "取消收藏" : "收藏",
                isSelected: model.article?.isFavorited == true
            ) {
                onAction(.favorite)
            }
            .disabled(accountActionsDisabled)

            if model.article?.isArchived == true {
                actionButton(
                    "tray.and.arrow.down",
                    "移回收件箱",
                    isSelected: true
                ) {
                    onAction(.inbox)
                }
                .disabled(accountActionsDisabled)
            } else {
                actionButton("archivebox", "归档", isSelected: false) {
                    onAction(.archive)
                }
                .disabled(accountActionsDisabled)
            }

            if model.article?.isPublished == true {
                actionButton(
                    "globe.badge.chevron.backward",
                    "取消公开",
                    isSelected: true
                ) {
                    onAction(.unpublish)
                }
                .disabled(accountActionsDisabled)
            } else {
                actionButton("globe", "公开", isSelected: false) {
                    onAction(.publish)
                }
                .disabled(accountActionsDisabled)
            }

            actionButton("arrow.clockwise", "重新抓取正文") {
                onAction(.refetch)
            }
            .disabled(accountActionsDisabled)
            actionButton("sparkles", "重新生成 AI 摘要和标签") {
                onAction(.regenerateAI)
            }
            .disabled(accountActionsDisabled)

            HStack(spacing: 2) {
                contentWidthButton(.normal, systemImage: "arrow.right.and.line.vertical.and.arrow.left")
                contentWidthButton(.wide, systemImage: "arrow.left.and.line.vertical.and.arrow.right")
            }
            .padding(2)
            .background {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .fill(.quinary)
            }
            .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control))

            Spacer(minLength: 8)

            if let article = model.article {
                ArticleExportMenu(article: article)
            }

            if let url = actionAvailability.originalURL {
                actionButton("safari", "打开原始网页") {
                    onAction(.openOriginal(url))
                }
                .disabled(model.isPerformingAction)
            }

            actionButton("trash", "删除文章", role: .destructive) {
                onAction(.delete)
            }
            .disabled(accountActionsDisabled)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var contentWidthSelection: Binding<ReaderContentWidthPreference> {
        Binding(
            get: { contentWidth },
            set: { onContentWidthChange($0) }
        )
    }

    private func contentWidthButton(
        _ preference: ReaderContentWidthPreference,
        systemImage: String
    ) -> some View {
        let isSelected = contentWidth == preference

        return Button {
            onContentWidthChange(preference)
        } label: {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(isSelected ? .white : .primary)
                .frame(width: 26, height: 24)
                .background {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isSelected ? QiankunjieColors.lightAccent : .clear)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(preference.displayName)正文宽度")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .help("正文宽度：\(preference.displayName)")
    }

    private func actionButton(
        _ systemImage: String,
        _ label: String,
        role: ButtonRole? = nil,
        isSelected: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        let accentColor = QiankunjieColors.accent(for: colorScheme)

        return Button(role: role) {
            action()
        } label: {
            Image(systemName: systemImage)
                .foregroundStyle(isSelected ? accentColor : colorScheme == .dark ? .white : .black)
                .frame(width: 28, height: 28)
                .background {
                    if isSelected {
                        Circle()
                            .fill(accentColor.opacity(0.13))
                    }
                }
        }
        .buttonStyle(.borderless)
        .help(label)
        .accessibilityLabel(label)
    }
}
