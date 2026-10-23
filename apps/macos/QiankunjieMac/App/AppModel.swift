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
    case categories
    case collectHistory
    case admin
    case settings

    var title: String {
        switch self {
        case .inbox: "收件箱"
        case .favorites: "收藏"
        case .archive: "归档"
        case .published: "已发布"
        case .categories: "分类管理"
        case .collectHistory: "历史任务"
        case .admin: "管理员设置"
        case .settings: "设置"
        }
    }

    var systemImage: String {
        switch self {
        case .inbox: "tray"
        case .favorites: "star"
        case .archive: "archivebox"
        case .published: "globe.americas"
        case .categories: "folder"
        case .collectHistory: "clock"
        case .admin: "shield"
        case .settings: "gearshape"
        }
    }

    var libraryView: LibraryView? {
        switch self {
        case .inbox: .inbox
        case .favorites: .favorites
        case .archive: .archive
        case .published: .published
        case .categories, .collectHistory, .admin, .settings: nil
        }
    }

    var requiresAuthentication: Bool {
        [.inbox, .favorites, .archive, .categories, .admin].contains(self)
    }

    var isAdminOnly: Bool {
        self == .admin
    }

    static var sidebarDestinations: [AppDestination] {
        [.inbox, .favorites, .archive, .published]
    }

    /// 系统管理分组：分类管理下面是历史任务。
    static var utilitySidebarDestinations: [AppDestination] {
        [.categories, .collectHistory, .settings, .admin]
    }

    /// 主侧栏中的管理员入口只对管理员展示；设置是所有用户都能进入的系统管理入口。
    static func visibleUtilitySidebarDestinations(isAdmin: Bool) -> [AppDestination] {
        utilitySidebarDestinations.filter { destination in
            !destination.isAdminOnly || isAdmin
        }
    }

    /// 未选中用空心符号、选中用实心符号；两者成对，保证切换时图标一定变化。
    func selectedSystemImage(isSelected: Bool) -> String {
        guard isSelected else { return systemImage }
        return switch self {
        case .inbox: "tray.fill"
        case .favorites: "star.fill"
        case .archive: "archivebox.fill"
        case .published: "globe.americas.fill"
        case .categories: "folder.fill"
        case .collectHistory: "clock.fill"
        case .admin: "shield.fill"
        case .settings: "gearshape.fill"
        }
    }
}

enum SettingsTool: String, CaseIterable, Hashable, Identifiable, Sendable {
    case general
    case aiModel
    case myMCP
    case resetPassword

    var id: String { rawValue }

    var title: String {
        switch self {
        case .general: "通用"
        case .aiModel: "AI 模型"
        case .myMCP: "我的 MCP"
        case .resetPassword: "重置密码"
        }
    }

    var systemImage: String {
        switch self {
        case .general: "switch.2"
        case .aiModel: "sparkles"
        case .myMCP: "point.3.connected.trianglepath.dotted"
        case .resetPassword: "lock.rotation"
        }
    }

    var subtitle: String {
        switch self {
        case .general: "偏好、更新与账号"
        case .aiModel: "模型配置与生成任务"
        case .myMCP: "连接、密钥与调用"
        case .resetPassword: "账号密码安全"
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
    let categoryCatalog: CategoryCatalogModel
    private(set) var libraryModel: LibraryModel
    private(set) var collectModel: CollectModel
    let searchModel: LibraryModel
    let bulkExportService: BulkArticleExportService
    private var weChatImportCoordinator: WeChatImportCoordinator?
    private var categoryCatalogRefreshTask: Task<Void, Never>?

    var user: AuthenticatedUser?
    var destination: AppDestination = .published
    private(set) var selectedCategoryID: Int?

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
        readerPositionStore: any ReaderPositionStoring = ReaderPositionStore(),
        categoryCatalog: CategoryCatalogModel? = nil
    ) {
        self.authModel = authModel
        self.categoryCatalog = categoryCatalog ?? CategoryCatalogModel(
            service: CategoryCatalogService(
                client: ManagementAPIClient(repository: authModel.repository)
            ),
            recentStore: CategoryRecentStore()
        )
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
        self.bulkExportService = BulkArticleExportService(tokenProvider: authModel.repository)
        let bulkExportService = self.bulkExportService
        let bulkObsidianService = BulkObsidianExportService(
            apiClient: readerAPIClient
        )
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
        collectModel.onArticleImported = { [weak self] _ in
            self?.refreshInboxAfterArticleImport()
        }
        self.libraryModel.bulkExportHandler = { job in
            let finishedJob = try await bulkExportService.poll(jobID: job.id)
            return try await bulkExportService.save(finishedJob)
        }
        self.libraryModel.bulkObsidianHandler = { articleIDs, destinationURL in
            let summary = try await bulkObsidianService.export(
                articleIDs: articleIDs,
                destinationURL: destinationURL
            )
            return NativeBulkResult(
                requestedCount: articleIDs.count,
                succeededCount: summary.succeededIDs.count,
                skippedCount: 0,
                failedCount: summary.failures.count,
                issues: summary.failures.map {
                    ArticleBulkIssue(articleID: $0.articleID, code: "EXPORT_FAILED", message: $0.message)
                }
            )
        }
        self.libraryModel.onCatalogAffectingChange = { [weak self] in
            self?.scheduleCategoryCatalogRefresh()
        }

        settingsModel.onUserStateCleared = { [weak self] in
            await self?.synchronizeWithAuthentication()
        }
        self.categoryCatalog.onCategoriesChanged = { [weak self] in
            self?.validateSelectedCategory()
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
        UpdateCompletionNoticeWindowController.shared.presentPendingUpdateCompletionNoticeIfNeeded()
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

    func presentCurrentVersionDetails() {
        UpdateCompletionNoticeWindowController.shared.presentCurrentVersion()
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

    /// 侧栏搜索会取消分类筛选，必须与共享导航状态一起清空分类 ID。
    func submitLibrarySearch() {
        selectedCategoryID = nil
        libraryModel.submitSearch()
    }

    /// 清除搜索时保持侧栏、工具栏和列表的分类状态一致。
    func clearLibrarySearch() {
        if libraryModel.isSearching {
            selectedCategoryID = nil
        }
        libraryModel.clearSearch()
    }

    /// 阅读器等非资料库模型通过同一入口刷新列表和分类计数。
    func handleLibraryDidChange() {
        scheduleCategoryCatalogRefresh()
        Task {
            await libraryModel.load(reset: true)
        }
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

        // 侧栏主栏目始终代表全部内容；从分类筛选进入归档主行时也要立即回到全部归档。
        let hadSelectedCategory = selectedCategoryID != nil
        selectedCategoryID = nil
        guard destination != self.destination else {
            if destination == .archive, hadSelectedCategory {
                libraryModel.selectCategory(nil)
                Task {
                    await libraryModel.load(reset: true)
                }
            } else if
                let view = destination.libraryView,
                libraryModel.isSearching
            {
                libraryModel.clearSearch()
                Task {
                    await libraryModel.load(reset: true)
                }
            }
            return
        }

        self.destination = destination
        hasExplicitDestinationSelection = true
        selectArticle(nil)
        if destination == .collectHistory {
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

    func selectCategory(_ categoryID: Int?) {
        if let categoryID,
           !categoryCatalog.activeCategories.contains(where: { $0.id == categoryID }) {
            return
        }

        destination = .archive
        selectedCategoryID = categoryID
        hasExplicitDestinationSelection = true
        selectArticle(nil)
        libraryModel.select(view: .archive)
        libraryModel.selectCategory(categoryID)
        Task {
            await libraryModel.load(reset: true)
        }
    }

    /// 轻量创建只负责产生分类，导航由表单成功回调完成，避免取消后仍被跳转。
    func createCategory(_ draft: CategoryDraft) async throws -> ArticleCategory {
        try await categoryCatalog.create(draft)
    }

    func createCategoryAndSelect(_ draft: CategoryDraft) async -> ArticleCategory? {
        guard categoryCatalog.hasLoadedCatalog else {
            categoryCatalog.presentError("分类目录尚未加载完成，请稍后重试")
            return nil
        }
        guard !categoryCatalog.isLoading else {
            categoryCatalog.presentError("分类目录正在加载，请稍后重试")
            return nil
        }
        guard !categoryCatalog.isMutating else {
            categoryCatalog.presentError("分类目录正在处理其他操作，请稍后再试")
            return nil
        }

        let 发起用户ID = categoryCatalog.userID

        do {
            let category = try await categoryCatalog.create(draft)
            guard categoryCatalog.userID == 发起用户ID else {
                return nil
            }
            selectCategory(category.id)
            guard selectedCategoryID == category.id else {
                categoryCatalog.presentError("分类已创建，但无法进入新分类，请稍后重试")
                return nil
            }
            return category
        } catch {
            guard categoryCatalog.userID == 发起用户ID else {
                return nil
            }
            if categoryCatalog.errorMessage == nil {
                categoryCatalog.presentError(managementErrorMessage(for: error))
            }
            return nil
        }
    }

    func validateSelectedCategory() {
        guard let selectedCategoryID else { return }
        guard !categoryCatalog.activeCategories.contains(where: { $0.id == selectedCategoryID }) else {
            return
        }

        self.selectedCategoryID = nil
        guard destination == .archive else { return }
        if libraryModel.view != .archive {
            libraryModel.select(view: .archive)
        }
        libraryModel.selectCategory(nil)
        Task {
            await libraryModel.load(reset: true)
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
        categoryCatalogRefreshTask?.cancel()
        categoryCatalogRefreshTask = nil
        categoryCatalog.prepareUser(userID: user?.id)
        collectModel.prepareUser(userID: user?.id)
        weChatImportCoordinator?.processPendingBatches()
        if previousLibraryUserID != user?.id {
            await libraryModel.clearUserScope(userID: previousLibraryUserID)
        }
        if isAuthenticated {
            await categoryCatalog.load()
        }
        await libraryModel.load(reset: true)
    }

    private func refreshInboxAfterArticleImport() {
        guard destination == .inbox else { return }

        Task {
            await libraryModel.load(reset: true)
        }
    }

    private func scheduleCategoryCatalogRefresh() {
        let expectedUserID = categoryCatalog.userID
        categoryCatalogRefreshTask?.cancel()
        categoryCatalogRefreshTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(200))
            guard
                !Task.isCancelled,
                let self,
                self.categoryCatalog.userID == expectedUserID
            else {
                return
            }
            await self.categoryCatalog.load()
            self.categoryCatalogRefreshTask = nil
        }
    }
}
