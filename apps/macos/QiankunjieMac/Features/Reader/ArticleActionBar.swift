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
    let onAction: (ReaderArticleAction) -> Void

    var body: some View {
        HStack(spacing: 8) {
            actionButton(
                model.article?.isFavorited == true ? "star.fill" : "star",
                model.article?.isFavorited == true ? "取消收藏" : "收藏"
            ) {
                onAction(.favorite)
            }

            if model.article?.isArchived == true {
                actionButton("tray.and.arrow.down", "移回收件箱") {
                    onAction(.inbox)
                }
            } else {
                actionButton("archivebox", "归档") {
                    onAction(.archive)
                }
            }

            if model.article?.isPublished == true {
                actionButton("globe.badge.chevron.backward", "取消公开") {
                    onAction(.unpublish)
                }
            } else {
                actionButton("globe", "公开") {
                    onAction(.publish)
                }
            }

            actionButton("arrow.clockwise", "重新抓取正文") {
                onAction(.refetch)
            }
            actionButton("sparkles", "重新生成 AI 摘要和标签") {
                onAction(.regenerateAI)
            }

            Spacer(minLength: 8)

            if let originalURL = model.article?.originalURL,
               let url = URL(string: originalURL),
               ReaderNavigationPolicy.decision(for: url) == .openExternally {
                actionButton("safari", "打开原始网页") {
                    onAction(.openOriginal(url))
                }
            }

            actionButton("trash", "删除文章", role: .destructive) {
                onAction(.delete)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .disabled(model.isPerformingAction || model.article == nil || isGuest)
    }

    private func actionButton(
        _ systemImage: String,
        _ label: String,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: role) {
            action()
        } label: {
            Image(systemName: systemImage)
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.borderless)
        .help(label)
        .accessibilityLabel(label)
    }
}
