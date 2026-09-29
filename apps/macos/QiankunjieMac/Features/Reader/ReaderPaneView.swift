import AppKit
import QiankunjieDesignSystem
import QiankunjieReader
import SwiftUI

struct ReaderPaneView: View {
    let selection: ReaderSelection?
    let onClose: () -> Void
    let onLibraryDidChange: () -> Void

    @State private var model = ReaderModel()
    @State private var pendingAction: ReaderArticleAction?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            if let selection, let article = model.article, article.id == selection.articleID {
                reader(article)
            } else if selection != nil, model.isLoading {
                stateView(title: "正在加载文章", systemImage: "doc.text")
            } else if selection != nil, let errorMessage = model.errorMessage {
                errorView(errorMessage)
            } else {
                stateView(
                    title: selection == nil ? "未选择文章" : "文章不可用",
                    systemImage: "doc.text"
                )
            }
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .task(id: selection) {
            if let selection {
                await model.open(selection)
            }
        }
    }

    private func reader(_ article: ReaderArticle) -> some View {
        VStack(spacing: 0) {
            header(article)
            Divider()
            ArticleActionBar(model: model, isGuest: selection?.isGuest == true) { action in
                requestAction(action)
            }
            Divider()

            if let actionErrorMessage = model.actionErrorMessage {
                Text(actionErrorMessage)
                    .font(QiankunjieTypography.labelMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(QiankunjieColors.surfaceVariant(for: colorScheme))
                Divider()
            }

            ReaderWebView(
                html: model.displayHTML,
                contentToken: model.contentToken,
                savedReadingState: model.savedReadingState
            ) { state, contentToken in
                model.updateReadingState(state, contentToken: contentToken)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .confirmationDialog(
            pendingAction?.confirmationTitle ?? "",
            isPresented: Binding(
                get: { pendingAction != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingAction = nil
                    }
                }
            ),
            titleVisibility: .visible,
            presenting: pendingAction
        ) { action in
            Button(action.buttonTitle, role: action.isDestructive ? .destructive : nil) {
                perform(action)
            }
            Button("取消", role: .cancel) {}
        } message: { action in
            Text(action.confirmationMessage)
        }
    }

    private func header(_ article: ReaderArticle) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(article.title ?? "未命名文章")
                    .font(QiankunjieTypography.headlineSmall)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Text(article.source ?? "乾坤戒")
                    if let time = article.publishTime ?? article.createdAt {
                        Text(time.formatted(.relative(presentation: .named)))
                    }
                    if article.isPublished {
                        Text("已公开")
                    }
                }
                .font(QiankunjieTypography.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 12)

            Button {
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .help("关闭文章")
            .accessibilityLabel("关闭文章")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private func stateView(
        title: String,
        systemImage: String
    ) -> some View {
        ContentUnavailableView(
            title,
            systemImage: systemImage
        )
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
            Text(message)
                .font(QiankunjieTypography.bodyMedium)
                .multilineTextAlignment(.center)
            Button("重试") {
                guard let selection else {
                    return
                }
                Task {
                    await model.open(selection)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private func requestAction(_ action: ReaderArticleAction) {
        switch action {
        case .favorite:
            perform(action)
        default:
            pendingAction = action
        }
    }

    private func perform(_ action: ReaderArticleAction) {
        pendingAction = nil
        model.onDeleted = onClose

        Task {
            switch action {
            case .favorite:
                await model.toggleFavorite()
            case .archive:
                await model.archive()
            case .inbox:
                await model.moveToInbox()
            case .publish:
                await model.publish()
            case .unpublish:
                await model.unpublish()
            case .refetch:
                await model.refetch()
            case .regenerateAI:
                await model.regenerateAI()
            case .delete:
                await model.delete()
                onLibraryDidChange()
                return
            case .openOriginal(let url):
                if ReaderNavigationPolicy.decision(for: url) == .openExternally {
                    NSWorkspace.shared.open(url)
                }
                return
            }

            if model.actionErrorMessage == nil {
                onLibraryDidChange()
            }
        }
    }
}
