#if DEBUG
import QiankunjieLibrary
import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieReader
import SwiftUI

/// 任务行的可用动作只由固定夹具状态推导，UI Lab 中的按钮不会访问真实仓储。
struct UILabTaskActionAvailability: Equatable, Sendable {
    let canOpenArticle: Bool
    let canRetry: Bool
    let canDelete: Bool
}

/// UI Lab 仅服务 Debug 视觉验收；Release 构建不包含这些类型和入口。
enum UILabScenario: String, CaseIterable, Hashable, Identifiable, Sendable {
    case login
    case library
    case empty
    case loading
    case offline
    case reader
    case collect
    case tasks
    case settings
    case update

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .login: "登录"
        case .library: "三栏资料库"
        case .empty: "空态"
        case .loading: "加载"
        case .offline: "离线"
        case .reader: "阅读器"
        case .collect: "采集"
        case .tasks: "任务"
        case .settings: "设置"
        case .update: "更新"
        }
    }

    static func commandLineScenario(arguments: [String]) -> UILabScenario? {
        guard
            let index = arguments.firstIndex(of: "--ui-lab"),
            arguments.indices.contains(index + 1)
        else { return nil }

        return UILabScenario(rawValue: arguments[index + 1])
    }

    static func fromCommandLine(arguments: [String] = CommandLine.arguments) -> UILabScenario? {
        commandLineScenario(arguments: arguments)
    }

    static func taskActionAvailability(for job: CollectJob) -> UILabTaskActionAvailability {
        UILabTaskActionAvailability(
            canOpenArticle: job.status == "completed" && job.articleId != nil,
            canRetry: job.status == "failed",
            canDelete: job.isTerminal
        )
    }
}

@MainActor
struct UILabRootView: View {
    let scenario: UILabScenario
    @State private var stateLibraryModel: LibraryModel?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            switch scenario {
            case .login:
                LoginView(
                    authModel: UILabFixtures.authModel,
                    onAuthenticated: {}
                )
            case .library:
                library
            case .empty:
                productionLibrary(.empty)
            case .loading:
                productionLibrary(.loading)
            case .offline:
                productionLibrary(.offline)
            case .reader:
                reader
            case .collect:
                CollectView(
                    model: UILabFixtures.collectModel,
                    onOpenArticle: { _ in }
                )
            case .tasks:
                CollectTasksView(
                    model: UILabFixtures.collectModel,
                    onOpenArticle: { _ in }
                )
            case .settings:
                SettingsWindow(
                    model: UILabFixtures.appModel.settingsModel,
                    shortcutSettings: UILabFixtures.appModel.shortcutSettings,
                    menuBarController: nil,
                    updateService: UILabFixtures.updateService,
                    updateDefaults: UILabFixtures.preferences
                )
            case .update:
                SettingsWindow(
                    model: UILabFixtures.appModel.settingsModel,
                    shortcutSettings: UILabFixtures.appModel.shortcutSettings,
                    menuBarController: nil,
                    updateService: UILabFixtures.updateService,
                    updateDefaults: UILabFixtures.preferences
                )
            }
        }
        .frame(minWidth: 960, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
        .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
        .navigationTitle("UI Lab · \(scenario.displayName)")
    }

    private var library: some View {
        NavigationSplitView {
            SidebarView(
                model: UILabFixtures.appModel,
                destinationSelection: .constant(.inbox)
            )
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } content: {
            CompactArticleListView(
                model: UILabFixtures.libraryModel,
                selection: .constant(UILabFixtures.article.id)
            )
            .task {
                await UILabFixtures.libraryModel.load(reset: true)
            }
            .navigationSplitViewColumnWidth(min: 280, ideal: 390, max: .infinity)
        } detail: {
            reader
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var reader: some View {
        ReaderPaneView(
            selection: ReaderSelection(
                articleID: UILabFixtures.article.id,
                publicID: nil,
                isGuest: false
            ),
            userID: UILabFixtures.user.id,
            positionStore: UILabFixtures.appModel.readerPositionStore,
            networkClient: UILabFixtures.readerClient,
            onClose: {},
            onLibraryDidChange: {}
        )
    }

    private func productionLibrary(_ state: FixtureLibraryState) -> some View {
        Group {
            if let model = stateLibraryModel {
                CompactArticleListView(model: model, selection: .constant(nil))
            } else {
                let model = UILabFixtures.libraryModel(for: state)
                CompactArticleListView(model: model, selection: .constant(nil))
                    .onAppear { stateLibraryModel = model }
            }
        }
        .task {
            if stateLibraryModel == nil {
                stateLibraryModel = UILabFixtures.libraryModel(for: state)
            }
            await stateLibraryModel?.load(reset: true)
        }
    }
}
#endif
