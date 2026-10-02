import Foundation
import Observation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieLibrary
import QiankunjieNetworking
import QiankunjieReader
import QiankunjieWeChat

enum AppDestination: String, CaseIterable, Hashable, Sendable {
    case inbox
    case favorites
    case archive
    case published
    case collect
    case admin
    case settings

    var title: String {
        switch self {
        case .inbox: "收件箱"
        case .favorites: "收藏"
        case .archive: "归档"
        case .published: "已发布"
        case .collect: "采集"
        case .admin: "管理员设置"
        case .settings: "设置"
        }
    }

    var systemImage: String {
        switch self {
        case .inbox: "tray"
        case .favorites: "star"
        case .archive: "archivebox"
        case .published: "globe"
        case .collect: "plus.rectangle.on.rectangle"
        case .admin: "shield.lefthalf.filled"
        case .settings: "gearshape"
        }
    }

    var libraryView: LibraryView? {
        switch self {
        case .inbox: .inbox
        case .favorites: .favorites
        case .archive: .archive
        case .published: .published
        case .collect, .admin, .settings: nil
        }
    }

    var requiresAuthentication: Bool {
        [.inbox, .favorites, .archive, .admin].contains(self)
    }

    var isAdminOnly: Bool {
        self == .admin
    }

    static var sidebarDestinations: [AppDestination] {
        allCases.filter { $0.libraryView != nil }
    }
}

enum SettingsTool: String, CaseIterable, Hashable, Identifiable, Sendable {
    case myMCP
    case categories
    case resetPassword

    var id: String { rawValue }

    var title: String {
        switch self {
        case .myMCP: "我的 MCP"
        case .categories: "分类管理"
        case .resetPassword: "重置密码"
        }
    }

    var systemImage: String {
        switch self {
        case .myMCP: "point.3.connected.trianglepath.dotted"
        case .categories: "folder"
        case .resetPassword: "lock.rotation"
        }
    }
}

enum AdminSettingsTab: String, CaseIterable, Identifiable, Sendable {
    case users
    case mcp
    case trash

    var id: String { rawValue }

    var title: String {
        switch self {
        case .users: "用户管理"
        case .mcp: "MCP 管理"
        case .trash: "回收站"
        }
    }

    var systemImage: String {
        switch self {
        case .users: "person.3"
        case .mcp: "key.horizontal"
        case .trash: "trash"
        }
    }
}

@MainActor
@Observable
final class AppModel {
    let authModel: AuthModel
    let collectAPIClient: APIClient
    let readerAPIClient: APIClient
    let settingsModel: SettingsModel
    let shortcutSettings: GlobalShortcutSettings
    let readerPositionStore: any ReaderPositionStoring
    private(set) var libraryModel: LibraryModel
    private(set) var collectModel: CollectModel
    let searchModel: LibraryModel
    private var weChatImportCoordinator: WeChatImportCoordinator?

    var user: AuthenticatedUser?
    var destination: AppDestination = .published

    /// 用户是否在当前会话里主动指定过要打开的页面。
    /// 启动阶段会异步恢复登录状态，如果不区分这一点，菜单栏打开设置后
    /// 会被恢复流程重新拽回首页。
    private var hasExplicitDestinationSelection = false
    var selectedArticleID: Int?
    var selectedReaderSelection: ReaderSelection?
    var isLoginPresented = false
    var isSearchPresented = false
    private(set) var updateCheckRequestID = 0

    init(
        authModel: AuthModel = AuthModel(repository: AuthRepository()),
        libraryModel: LibraryModel? = nil,
        collectRepository: (any CollectServicing)? = nil,
        shortcutDefaults: UserDefaults = .standard,
        readerPositionStore: any ReaderPositionStoring = ReaderPositionStore()
    ) {
        self.authModel = authModel
        if let libraryModel {
            self.libraryModel = libraryModel
        } else {
            self.libraryModel = LibraryModel(
                repository: LibraryRepository(
                    apiClient: APIClient(tokenProvider: authModel.repository)
                ),
                cache: (try? LibraryCache()) ?? EmptyLibraryCache()
            )
        }
        let collectAPIClient = APIClient(tokenProvider: authModel.repository)
        self.collectAPIClient = collectAPIClient
        self.readerAPIClient = APIClient(tokenProvider: authModel.repository)
        self.searchModel = LibraryModel(
            repository: LibraryRepository(
                apiClient: APIClient(tokenProvider: authModel.repository)
            ),
            cache: EmptyLibraryCache()
        )
        self.shortcutSettings = GlobalShortcutSettings(defaults: shortcutDefaults)
        self.readerPositionStore = readerPositionStore
        let settingsModel = SettingsModel(
            authModel: authModel,
            appearanceDefaults: shortcutDefaults
        )
        self.settingsModel = settingsModel
        self.collectModel = CollectModel(
            repository: collectRepository ?? CollectRepository(
                apiClient: collectAPIClient
            ),
            userID: authModel.user?.id
        )

        settingsModel.onUserStateCleared = { [weak self] in
            await self?.synchronizeWithAuthentication()
        }
    }

    var isAuthenticated: Bool {
        user != nil
    }

    func start() async {
        if weChatImportCoordinator == nil {
            weChatImportCoordinator = WeChatImportCoordinator(
                repository: WeChatImportRepository(apiClient: collectAPIClient),
                isAuthenticated: { [weak self] in self?.user != nil },
                onImported: { [weak self] _ in
                    await self?.libraryModel.load(reset: true)
                }
            )
        }
        weChatImportCoordinator?.start()
        await authModel.restore()
        await synchronizeWithAuthentication()
    }

    func didAuthenticate() {
        isLoginPresented = false
        hasExplicitDestinationSelection = false
        Task {
            await synchronizeWithAuthentication()
        }
    }

    func didLogout() async {
        await settingsModel.logout()
        isLoginPresented = false
        hasExplicitDestinationSelection = false
    }

    func presentLogin() {
        authModel.clearError()
        isLoginPresented = true
    }

    func dismissLogin() {
        isLoginPresented = false
    }

    func requestUpdateCheck() {
        updateCheckRequestID += 1
    }

    func toggleSearch() {
        if isSearchPresented {
            closeSearch()
        } else {
            openSearch()
        }
    }

    func openSearch() {
        isSearchPresented = true
        selectArticle(nil)
    }

    func closeSearch() {
        isSearchPresented = false
        selectArticle(nil)
    }

    func selectSearchArticle(_ article: ArticleCard) {
        selectedArticleID = article.id
        selectedReaderSelection = ReaderSelection(
            articleID: article.id,
            publicID: article.publicID,
            isGuest: !isAuthenticated
        )
    }

    func selectDestination(_ destination: AppDestination) {
        if destination.isAdminOnly, user?.role != "admin" {
            return
        }
        guard destination != self.destination else {
            return
        }

        self.destination = destination
        hasExplicitDestinationSelection = true
        selectArticle(nil)
        if destination == .collect {
            Task {
                await collectModel.refreshJobs()
            }
        } else if let view = destination.libraryView {
            libraryModel.select(view: view)
            if isAuthenticated || view == .published {
                Task {
                    await libraryModel.load(reset: true)
                }
            }
        }
    }

    func selectArticle(_ articleID: Int?) {
        selectedArticleID = articleID
        guard let articleID else {
            selectedReaderSelection = nil
            return
        }

        selectedReaderSelection = ReaderSelection(
            articleID: articleID,
            publicID: libraryModel.articles.first { $0.id == articleID }?.publicID,
            isGuest: !isAuthenticated
        )
    }

    func closeArticle() {
        selectArticle(nil)
    }

    func openCollectArticle(_ job: CollectJob) {
        guard
            isAuthenticated,
            let articleID = job.articleId
        else {
            return
        }

        selectedArticleID = articleID
        selectedReaderSelection = ReaderSelection(
            articleID: articleID,
            publicID: nil,
            isGuest: false
        )
    }

    private func synchronizeWithAuthentication() async {
        let previousLibraryUserID = libraryModel.userID
        user = authModel.user
        selectArticle(nil)
        isSearchPresented = false
        searchModel.prepareUser(
            userID: user?.id,
            view: .inbox
        )
        readerPositionStore.prepareUser(userID: user?.id)
        if !hasExplicitDestinationSelection {
            destination = user == nil ? .published : .inbox
        }
        libraryModel.prepareUser(
            userID: user?.id,
            view: destination.libraryView ?? .published
        )
        collectModel.prepareUser(userID: user?.id)
        weChatImportCoordinator?.processPendingBatches()
        if previousLibraryUserID != user?.id {
            await libraryModel.clearUserScope(userID: previousLibraryUserID)
        }
        await libraryModel.load(reset: true)
    }
}
