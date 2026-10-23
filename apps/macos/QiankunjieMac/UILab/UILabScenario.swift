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

enum UILabAppearance: String, Sendable {
    case light
    case dark

    var colorScheme: ColorScheme {
        switch self {
        case .light: .light
        case .dark: .dark
        }
    }

    static func commandLineColorScheme(arguments: [String] = CommandLine.arguments) -> ColorScheme? {
        guard
            let index = arguments.firstIndex(of: "--ui-lab-appearance"),
            arguments.indices.contains(index + 1),
            let appearance = UILabAppearance(rawValue: arguments[index + 1])
        else {
            return nil
        }
        return appearance.colorScheme
    }
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
    case updateNotice = "update-notice"
    case currentVersion = "current-version"
    case categoryPicker = "category-picker"
    case categoryManagement = "category-management"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .login: "登录"
        case .library: "三栏资料库"
        case .empty: "空态"
        case .loading: "加载"
        case .offline: "离线"
        case .reader: "阅读器"
        case .collect: "快速采集"
        case .tasks: "任务"
        case .settings: "设置"
        case .update: "更新"
        case .updateNotice: "更新完成"
        case .currentVersion: "当前版本更新"
        case .categoryPicker: "分类选择器"
        case .categoryManagement: "分类管理"
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
    @State private var presentationMode: ArticleListPresentationMode = .compactList
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
                CollectQuickPopoverView(model: UILabFixtures.collectModel)
            case .tasks:
                CollectHistoryView(
                    model: UILabFixtures.collectModel,
                    onOpenArticle: { _ in }
                )
            case .settings:
                SettingsGeneralView(
                    model: UILabFixtures.appModel.settingsModel,
                    shortcutSettings: UILabFixtures.appModel.shortcutSettings,
                    menuBarController: nil,
                    isAuthenticated: true,
                    onLogin: {},
                    updateService: UILabFixtures.updateService,
                    updateDefaults: UILabFixtures.preferences
                )
            case .update:
                SettingsGeneralView(
                    model: UILabFixtures.appModel.settingsModel,
                    shortcutSettings: UILabFixtures.appModel.shortcutSettings,
                    menuBarController: nil,
                    isAuthenticated: true,
                    onLogin: {},
                    updateCheckRequestID: 1,
                    updateService: UILabFixtures.updateService,
                    updateDefaults: UILabFixtures.preferences
                )
            case .updateNotice:
                UpdateCompletionNoticeView(
                    notice: UILabFixtures.updateCompletionNotice,
                    presentation: .updateCompleted,
                    onOpenFullNotes: {},
                    onDismiss: {}
                )
            case .currentVersion:
                UpdateCompletionNoticeView(
                    notice: UILabFixtures.currentVersionNotice,
                    presentation: .currentVersion,
                    loadNotes: { @Sendable in
                        await MainActor.run { UILabFixtures.refreshedCurrentVersionNotes }
                    },
                    onOpenFullNotes: {},
                    onDismiss: {}
                )
            case .categoryPicker:
                UILabCategoryPickerScene()
            case .categoryManagement:
                CategoryManagementView(catalog: UILabFixtures.categoryCatalog)
            }
        }
        .frame(minWidth: 960, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
        .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
        .preferredColorScheme(UILabAppearance.commandLineColorScheme())
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
                categoryCatalog: UILabFixtures.categoryCatalog,
                selectedCategoryID: nil,
                onSelectCategory: { _ in },
                selection: .constant(UILabFixtures.article.id),
                presentationMode: $presentationMode
            )
            .task {
                await UILabFixtures.libraryModel.load(reset: true)
            }
            .navigationSplitViewColumnWidth(min: 280, ideal: 390, max: .infinity)
        } detail: {
            reader
        }
        .navigationSplitViewStyle(.balanced)
        .task {
            await UILabFixtures.categoryCatalog.load()
        }
    }

    private var reader: some View {
            ReaderPaneView(
                selection: ReaderSelection(
                    articleID: UILabFixtures.article.id,
                    publicID: nil,
                    isGuest: false
                ),
                userID: UILabFixtures.user.id,
                categoryCatalog: UILabFixtures.categoryCatalog,
                appFont: .standard,
                readerContentWidth: .normal,
                positionStore: UILabFixtures.appModel.readerPositionStore,
                networkClient: UILabFixtures.readerClient,
                onClose: {},
                onLibraryDidChange: {}
            )
    }

    private func productionLibrary(_ state: FixtureLibraryState) -> some View {
        Group {
            if let model = stateLibraryModel {
                CompactArticleListView(
                    model: model,
                    categoryCatalog: UILabFixtures.categoryCatalog,
                    selectedCategoryID: nil,
                    onSelectCategory: { _ in },
                    selection: .constant(nil),
                    presentationMode: $presentationMode
                )
            } else {
                let model = UILabFixtures.libraryModel(for: state)
                CompactArticleListView(
                    model: model,
                    categoryCatalog: UILabFixtures.categoryCatalog,
                    selectedCategoryID: nil,
                    onSelectCategory: { _ in },
                    selection: .constant(nil),
                    presentationMode: $presentationMode
                )
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

@MainActor
private struct UILabCategoryPickerScene: View {
    @State private var model: CategoryPickerModel
    @Environment(\.colorScheme) private var colorScheme

    init() {
        _model = State(initialValue: CategoryPickerModel(
            catalog: UILabFixtures.categoryCatalog,
            selectedCategoryID: 3,
            targetCount: 3
        ))
    }

    var body: some View {
        CategoryPickerContent(
            model: model,
            title: "归档到哪里？",
            subtitle: "分类只用于归档文章。选择分类后，文章会移入「归档」；也可以让 AI 判断。",
            onSelectCategory: { category in
                分类结果(for: category)
            },
            onSelectAI: {
                .failure(message: "网络连接失败，请检查网络后重试")
            },
            onDismiss: {}
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    /// 固定场景用不同分类触发成功与部分成功，便于人工检查完整文案和布局。
    private func 分类结果(for category: ArticleCategory) -> CategoryAssignmentOutcome {
        if category.name == "生活" || category.name == "项目复盘" {
            return .partial(
                succeededCount: 2,
                skippedCount: 0,
                failedCount: 1,
                message: "1 篇文章已被其他操作锁定，请稍后重试"
            )
        }
        return .success(succeededCount: 3, skippedCount: 0)
    }
}
#endif
