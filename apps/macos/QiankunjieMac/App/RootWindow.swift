import QiankunjieDesignSystem
import QiankunjieCollect
import QiankunjieLibrary
import SwiftUI

struct RootWindow: View {
    @Bindable var model: AppModel
    @Binding var menuBarController: MenuBarController?
    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorScheme) private var colorScheme
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic
    @State private var availableWidth: CGFloat = 0
    private let layoutPolicy = AppShellLayoutPolicy()

    var body: some View {
        mainInterface
            .preferredColorScheme(
                model.settingsModel.appearance.resolvedColorScheme(system: colorScheme)
            )
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
            .onAppear {
                installMenuBarIfNeeded()
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
            readerPane
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var listDetailShell: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            listColumn
        } detail: {
            readerPane
        }
        .navigationSplitViewStyle(.balanced)
    }

    @ViewBuilder
    private var listColumn: some View {
        if let libraryView = model.destination.libraryView {
            CompactArticleListView(
                model: model.libraryModel,
                selection: articleSelection
            )
            .id(libraryView)
        } else if model.destination == .collect {
            CollectView(
                model: model.collectModel,
                onOpenArticle: model.openCollectArticle
            )
        } else if model.destination == .tasks {
            CollectTasksView(
                model: model.collectModel,
                onOpenArticle: model.openCollectArticle
            )
        } else if model.destination == .settings {
            SettingsView(
                model: model,
                menuBarController: menuBarController
            )
        } else if model.destination == .search {
            LibrarySearchView(
                model: model.libraryModel,
                selection: articleSelection
            )
        } else {
            LibraryPlaceholderView(destination: model.destination)
        }
    }

    private var articleSelection: Binding<Int?> {
        Binding(
            get: { model.selectedArticleID },
            set: { model.selectArticle($0) }
        )
    }

    private var readerPane: some View {
        ReaderPaneView(
            selection: model.selectedReaderSelection,
            userID: model.user?.id,
            positionStore: model.readerPositionStore,
            onClose: {
                model.closeArticle()
            },
            onLibraryDidChange: {
                Task {
                    await model.libraryModel.load(reset: true)
                }
            }
        )
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

    private func installMenuBarIfNeeded() {
        guard menuBarController == nil else { return }

        let controller = MenuBarController(
            appModel: model,
            shortcut: model.shortcutSettings.shortcut,
            onShowMainWindow: {
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
        )
        controller.start()
        menuBarController = controller
    }

    private var destinationSelection: Binding<AppDestination> {
        Binding(
            get: { model.destination },
            set: { model.selectDestination($0) }
        )
    }
}

private struct LibrarySearchView: View {
    let model: LibraryModel
    let selection: Binding<Int?>

    var body: some View {
        CompactArticleListView(
            model: model,
            selection: selection
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
