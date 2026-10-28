import AppKit
import QiankunjieDesignSystem
import SwiftUI

/// 资料库列表与阅读器的独立分栏容器。
/// 拖拽状态只留在这一层，避免每个鼠标事件都让主窗口整棵视图树重新计算。
struct LibraryWorkspaceView<ArticleList: View, Reader: View>: View {
    let overrideWidth: CGFloat?
    let onCommitWidth: (CGFloat) -> Void
    let articleList: ArticleList
    let reader: Reader

    @Environment(\.colorScheme) private var colorScheme
    @State private var draftWidth: CGFloat?
    @State private var dragStartWidth: CGFloat?
    private let widthPolicy = AppShellColumnWidthPolicy()

    private static var coordinateSpaceName: String {
        "library-workspace-split"
    }

    init(
        overrideWidth: CGFloat?,
        onCommitWidth: @escaping (CGFloat) -> Void,
        @ViewBuilder articleList: () -> ArticleList,
        @ViewBuilder reader: () -> Reader
    ) {
        self.overrideWidth = overrideWidth
        self.onCommitWidth = onCommitWidth
        self.articleList = articleList()
        self.reader = reader()
    }

    var body: some View {
        GeometryReader { proxy in
            let width = widthPolicy.contentColumnWidth(
                workspaceWidth: proxy.size.width,
                overrideWidth: draftWidth ?? overrideWidth
            )

            HStack(spacing: 0) {
                articleList
                    .frame(width: width.width)
                    .frame(maxHeight: .infinity)

                splitHandle(
                    currentWidth: width.width,
                    workspaceWidth: proxy.size.width
                )

                reader
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .transaction { transaction in
                transaction.animation = nil
            }
        }
        .coordinateSpace(name: Self.coordinateSpaceName)
    }

    private func splitHandle(
        currentWidth: CGFloat,
        workspaceWidth: CGFloat
    ) -> some View {
        ZStack {
            Rectangle()
                .fill(QiankunjieColors.outline(for: colorScheme))
                .frame(width: 1)

            Color.clear
                .contentShape(Rectangle())
        }
        .frame(width: 7)
        .frame(maxHeight: .infinity)
        .onContinuousHover { phase in
            switch phase {
            case .active:
                NSCursor.resizeLeftRight.set()
            case .ended:
                NSCursor.arrow.set()
            }
        }
        .gesture(
            DragGesture(
                minimumDistance: 0,
                coordinateSpace: .named(Self.coordinateSpaceName)
            )
            .onChanged { value in
                if dragStartWidth == nil {
                    dragStartWidth = currentWidth
                }
                let startWidth = dragStartWidth ?? currentWidth
                draftWidth = widthPolicy.draggedContentWidth(
                    startingWidth: startWidth,
                    translation: value.translation.width,
                    workspaceWidth: workspaceWidth
                )
            }
            .onEnded { value in
                let startWidth = dragStartWidth ?? currentWidth
                let finalWidth = widthPolicy.draggedContentWidth(
                    startingWidth: startWidth,
                    translation: value.translation.width,
                    workspaceWidth: workspaceWidth
                )
                draftWidth = finalWidth
                dragStartWidth = nil
                onCommitWidth(finalWidth)
            }
        )
        .accessibilityElement()
        .accessibilityLabel("调整文章列表宽度")
        .accessibilityValue("\(Int(currentWidth.rounded())) 点")
    }
}
