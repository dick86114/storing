import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import SwiftUI

struct CompactArticleListView: View {
    @Bindable var model: LibraryModel
    @Binding var selection: Int?
    @Environment(\.colorScheme) private var colorScheme

    private let paginationPreviewCount = 6

    var body: some View {
        VStack(spacing: 0) {
            LibraryToolbar(model: model)
            Rectangle()
                .fill(QiankunjieColors.outline(for: colorScheme))
                .frame(height: 1)
            content
        }
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var content: some View {
        Group {
            switch model.displayState {
            case .loading:
                loadingView
            case .empty:
                emptyView
            case .error:
                errorView
            case .content:
                articleList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var articleList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(
                    Array(model.articles.enumerated()),
                    id: \.element.id
                ) { index, article in
                    articleRow(article)
                        .onAppear {
                            if index >= model.articles.count - paginationPreviewCount {
                                Task {
                                    await model.loadMore()
                                }
                            }
                        }
                }

                if model.isLoadingMore {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在加载更多")
                    }
                    .font(QiankunjieTypography.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .padding(.vertical, 8)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
    }

    private func articleRow(_ article: ArticleCard) -> some View {
        let isSelected = selection == article.id

        return Button {
            selection = article.id
        } label: {
            HStack(alignment: .top, spacing: 10) {
                cover(article)

                VStack(alignment: .leading, spacing: 5) {
                    Text(article.title ?? "未命名文章")
                        .font(QiankunjieTypography.titleMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)

                    Text(article.aiSummary ?? "暂无摘要")
                        .font(QiankunjieTypography.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .lineLimit(2)

                    HStack(spacing: 8) {
                        Label(
                            article.source ?? "未知来源",
                            systemImage: sourceSystemImage(article.source)
                        )
                        if let time = displayTime(article) {
                            Label(time, systemImage: "clock")
                        }
                    }
                    .font(QiankunjieTypography.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .lineLimit(1)

                    tags(article)
                }

                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(minHeight: 92, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background {
            GlassSurface(role: .control, cornerRadius: QiankunjieRadius.control) {
                Color.clear
            }
        }
        .overlay {
            if isSelected {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(
                        QiankunjieColors.accent(for: colorScheme),
                        lineWidth: 1.5
                    )
            }
        }
    }

    private func cover(_ article: ArticleCard) -> some View {
        ZStack {
            if
                let coverText = article.coverImage,
                let url = URL(string: coverText)
            {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        fallbackCover(article)
                    }
                }
            } else {
                fallbackCover(article)
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .accessibilityLabel("文章封面")
    }

    private func fallbackCover(_ article: ArticleCard) -> some View {
        let palette = ArticleCoverFallback.forArticle(article.id)

        return ZStack {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(palette.gradient)
            BrandAssetName.qiankunjieMark.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .padding(12)
                .opacity(0.82)
        }
    }

    private func tags(_ article: ArticleCard) -> some View {
        HStack(spacing: 5) {
            ForEach(prefix(article.aiTags, count: 3), id: \.self) { tag in
                Text(tag)
                    .font(QiankunjieTypography.labelMedium)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(QiankunjieColors.surface(for: colorScheme))
                    .clipShape(Capsule())
                    .overlay {
                        Capsule()
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
            }
        }
    }

    private var loadingView: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("正在加载文章")
                .font(QiankunjieTypography.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            let asset = colorScheme == .dark
                ? BrandAssetName.emptyLibraryDark
                : BrandAssetName.emptyLibraryLight

            asset.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 96, height: 96)
            Text("资料库为空")
                .font(QiankunjieTypography.titleMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        }
    }

    private var errorView: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
            Text(model.errorMessage ?? "加载资料库失败")
                .font(QiankunjieTypography.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .multilineTextAlignment(.center)
            Button {
                Task {
                    await model.retry()
                }
            } label: {
                Label("重试", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private func displayTime(_ article: ArticleCard) -> String? {
        article.publishTime?.formatted(.relative(presentation: .named))
            ?? article.createdAt?.formatted(.relative(presentation: .named))
    }

    private func sourceSystemImage(_ source: String?) -> String {
        source == "微信公众号" ? "person.2" : "doc.text"
    }

    private func prefix(_ values: [String], count: Int) -> [String] {
        Array(values.prefix(count))
    }
}
