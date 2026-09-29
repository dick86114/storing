import Observation
import QiankunjieAuth

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
}

@MainActor
@Observable
final class AppModel {
    let authModel: AuthModel

    var user: AuthenticatedUser?
    var destination: AppDestination = .published
    var selectedArticleID: Int?
    var isLoginPresented = false

    init(authModel: AuthModel = AuthModel(repository: AuthRepository())) {
        self.authModel = authModel
    }

    var isAuthenticated: Bool {
        user != nil
    }

    func start() async {
        await authModel.restore()
        synchronizeWithAuthentication()
    }

    func didAuthenticate() {
        synchronizeWithAuthentication()
        isLoginPresented = false
    }

    func didLogout() async {
        await authModel.logout()
        synchronizeWithAuthentication()
        isLoginPresented = false
    }

    func presentLogin() {
        isLoginPresented = true
    }

    private func synchronizeWithAuthentication() {
        user = authModel.user
        selectedArticleID = nil
        destination = user == nil ? .published : .inbox
    }
}
