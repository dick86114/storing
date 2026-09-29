import QiankunjieDesignSystem
import SwiftUI

struct RootWindow: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var colorScheme
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        if model.isAuthenticated {
            mainInterface
        } else {
            LoginView(
                authModel: model.authModel,
                onAuthenticated: model.didAuthenticate
            )
        }
    }

    private var mainInterface: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(model: model)
                .navigationSplitViewColumnWidth(
                    min: 180,
                    ideal: 220,
                    max: 280
                )
        } content: {
            LibraryPlaceholderView(destination: model.destination)
                .navigationSplitViewColumnWidth(
                    min: 280,
                    ideal: 400,
                    max: .infinity
                )
        } detail: {
            ReaderPlaceholderView(articleID: model.selectedArticleID)
        }
        .navigationSplitViewStyle(.balanced)
        .background(QiankunjieColors.background(for: colorScheme))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task {
                        await model.didLogout()
                    }
                } label: {
                    Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
    }
}

private struct LibraryPlaceholderView: View {
    let destination: AppDestination

    var body: some View {
        ContentUnavailableView(
            "暂无内容",
            systemImage: "list.bullet.rectangle",
            description: Text(destination.title)
        )
    }
}

private struct ReaderPlaceholderView: View {
    let articleID: Int?

    var body: some View {
        if let articleID {
            ContentUnavailableView(
                "文章 \(articleID)",
                systemImage: "doc.text"
            )
        } else {
            ContentUnavailableView(
                "未选择文章",
                systemImage: "doc.text"
            )
        }
    }
}
