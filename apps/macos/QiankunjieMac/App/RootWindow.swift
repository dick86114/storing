import QiankunjieDesignSystem
import SwiftUI

struct RootWindow: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var colorScheme
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic
    @State private var availableWidth: CGFloat = 0
    private let layoutPolicy = AppShellLayoutPolicy()

    var body: some View {
        mainInterface
            .sheet(isPresented: $model.isLoginPresented) {
            LoginView(
                authModel: model.authModel,
                onAuthenticated: model.didAuthenticate
            )
        }
    }

    private var mainInterface: some View {
        shell
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
            } action: { newValue in
                availableWidth = newValue
            }
            .onChange(of: layout) { _, newLayout in
                updateColumnVisibility(for: newLayout)
            }
            .background(QiankunjieColors.background(for: colorScheme))
            .toolbar {
                authenticationToolbar
            }
    }

    private var layout: AppShellLayout {
        layoutPolicy.layout(
            availableWidth: availableWidth,
            selectedArticleID: model.selectedArticleID
        )
    }

    @ViewBuilder
    private var shell: some View {
        switch layout {
        case .threeColumns:
            threeColumnShell
        case .listDetail:
            listDetailShell
        }
    }

    private var threeColumnShell: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(
                model: model,
                destinationSelection: destinationSelection
            )
                .navigationSplitViewColumnWidth(
                    min: 180,
                    ideal: 220,
                    max: 280
                )
        } content: {
            listColumn
                .navigationSplitViewColumnWidth(
                    min: 280,
                    ideal: 400,
                    max: .infinity
                )
        } detail: {
            ReaderPlaceholderView(articleID: model.selectedArticleID)
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var listDetailShell: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            listColumn
        } detail: {
            ReaderPlaceholderView(articleID: model.selectedArticleID)
        }
        .navigationSplitViewStyle(.balanced)
    }

    @ViewBuilder
    private var listColumn: some View {
        if let libraryView = model.destination.libraryView {
            CompactArticleListView(
                model: model.libraryModel,
                selection: $model.selectedArticleID
            )
            .id(libraryView)
        } else {
            LibraryPlaceholderView(destination: model.destination)
        }
    }

    @ToolbarContentBuilder
    private var authenticationToolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            if model.isAuthenticated {
                Button {
                    Task {
                        await model.didLogout()
                    }
                } label: {
                    Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } else {
                Button {
                    model.presentLogin()
                } label: {
                    Label("登录", systemImage: "person.badge.key")
                }
            }
        }
    }

    private func updateColumnVisibility(for layout: AppShellLayout) {
        switch layout {
        case .threeColumns:
            columnVisibility = .automatic
        case .listDetail(let isReaderPrimary):
            columnVisibility = isReaderPrimary ? .detailOnly : .all
        }
    }

    private var destinationSelection: Binding<AppDestination> {
        Binding(
            get: { model.destination },
            set: { model.selectDestination($0) }
        )
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
