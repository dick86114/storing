import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieLibrary
import QiankunjieNetworking

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
    private(set) var libraryModel: LibraryModel

    var user: AuthenticatedUser?
    var destination: AppDestination = .published
    var selectedArticleID: Int?
    var isLoginPresented = false

    init(
        authModel: AuthModel = AuthModel(repository: AuthRepository()),
        libraryModel: LibraryModel? = nil
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
        await authModel.logout()
        await synchronizeWithAuthentication()
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
        selectedArticleID = nil
        if let view = destination.libraryView {
            libraryModel.select(view: view)
            Task {
                await libraryModel.load(reset: true)
            }
        }
    }

    private func synchronizeWithAuthentication() async {
        let previousLibraryUserID = libraryModel.userID
        user = authModel.user
        selectedArticleID = nil
        destination = user == nil ? .published : .inbox
        libraryModel.prepareUser(
            userID: user?.id,
            view: destination.libraryView ?? .published
        )
        if previousLibraryUserID != user?.id {
            await libraryModel.clearUserScope(userID: previousLibraryUserID)
        }
        await libraryModel.load(reset: true)
    }
}
