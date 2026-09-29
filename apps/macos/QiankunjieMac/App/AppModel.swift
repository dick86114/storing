import Foundation
import Observation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieLibrary
import QiankunjieNetworking
import QiankunjieReader

enum AppDestination: String, CaseIterable, Hashable, Sendable {
    case inbox
    case favorites
    case archive
    case published
    case collect
    case tasks
    case search
    case settings

    var title: String {
        switch self {
        case .inbox: "收件箱"
        case .favorites: "收藏"
        case .archive: "归档"
        case .published: "已发布"
        case .collect: "收集"
        case .tasks: "任务"
        case .search: "搜索"
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
        case .tasks: "checklist"
        case .search: "magnifyingglass"
        case .settings: "gearshape"
        }
    }

    var libraryView: LibraryView? {
        switch self {
        case .inbox: .inbox
        case .favorites: .favorites
        case .archive: .archive
        case .published: .published
        case .collect, .tasks, .search, .settings: nil
        }
    }
}

@MainActor
@Observable
final class AppModel {
    let authModel: AuthModel
    let collectAPIClient: APIClient
    let settingsModel: SettingsModel
    let shortcutSettings: GlobalShortcutSettings
    let readerPositionStore: any ReaderPositionStoring
    private(set) var libraryModel: LibraryModel
    private(set) var collectModel: CollectModel

    var user: AuthenticatedUser?
    var destination: AppDestination = .published
    var selectedArticleID: Int?
    var selectedReaderSelection: ReaderSelection?
    var isLoginPresented = false

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
        await authModel.restore()
        await synchronizeWithAuthentication()
    }

    func didAuthenticate() {
        isLoginPresented = false
        Task {
            await synchronizeWithAuthentication()
        }
    }

    func didLogout() async {
        await settingsModel.logout()
        isLoginPresented = false
    }

    func presentLogin() {
        isLoginPresented = true
    }

    func selectDestination(_ destination: AppDestination) {
        guard destination != self.destination else {
            return
        }

        self.destination = destination
        selectArticle(nil)
        if destination == .collect || destination == .tasks {
            Task {
                await collectModel.refreshJobs()
            }
        } else if let view = destination.libraryView {
            libraryModel.select(view: view)
            Task {
                await libraryModel.load(reset: true)
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
        readerPositionStore.prepareUser(userID: user?.id)
        destination = user == nil ? .published : .inbox
        libraryModel.prepareUser(
            userID: user?.id,
            view: destination.libraryView ?? .published
        )
        collectModel.prepareUser(userID: user?.id)
        if previousLibraryUserID != user?.id {
            await libraryModel.clearUserScope(userID: previousLibraryUserID)
        }
        await libraryModel.load(reset: true)
    }
}
