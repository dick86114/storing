import AppKit
import Foundation
import QiankunjieCore
import UserNotifications
@testable import QiankunjieCollect
@testable import QiankunjieMac
import Testing

@MainActor
struct MenuBarStateTests {
    @Test func 菜单栏和快捷键共享同一个快速采集面板() {
        let collectModel = CollectModel(userID: 7)
        let panel = QuickCollectPanelSpy(model: collectModel)
        let hotKeys = HotKeyRegistrarSpy()
        let lifecycle = ObserverCenterSpy()
        let controller = MenuBarController(
            model: collectModel,
            panel: panel,
            hotKeys: hotKeys,
            observerCenter: lifecycle,
            shortcut: .default
        )

        controller.start()
        controller.togglePanel()

        #expect(panel.model === collectModel)
        #expect(panel.isPresented)
        #expect(hotKeys.registeredShortcuts == [.default])

        controller.togglePanel()

        #expect(!panel.isPresented)
    }

    @Test func 登录状态刷新不会重复注册快捷键() {
        let collectModel = CollectModel(userID: nil)
        let panel = QuickCollectPanelSpy(model: collectModel)
        let hotKeys = HotKeyRegistrarSpy()
        let lifecycle = ObserverCenterSpy()
        let controller = MenuBarController(
            model: collectModel,
            panel: panel,
            hotKeys: hotKeys,
            observerCenter: lifecycle,
            shortcut: .default
        )

        controller.start()
        #expect(controller.state == .guest)

        collectModel.prepareUser(userID: 7)
        controller.handleAppDidBecomeActive()
        controller.handleAppDidBecomeActive()

        #expect(controller.state == .authenticated)
        #expect(hotKeys.registeredShortcuts == [.default])
    }

    @Test func 切换快捷键会先注销旧组合再注册新组合() {
        let collectModel = CollectModel(userID: 7)
        let panel = QuickCollectPanelSpy(model: collectModel)
        let hotKeys = HotKeyRegistrarSpy()
        let lifecycle = ObserverCenterSpy()
        let controller = MenuBarController(
            model: collectModel,
            panel: panel,
            hotKeys: hotKeys,
            observerCenter: lifecycle,
            shortcut: .default
        )

        controller.start()
        controller.updateShortcut(.default)
        controller.updateShortcut(.shiftCommandS)

        #expect(
            hotKeys.events == [
                .register(.default),
                .unregister,
                .register(.shiftCommandS),
            ]
        )
        #expect(hotKeys.registeredShortcuts == [.shiftCommandS])
    }

    @Test func 停止菜单栏会关闭面板并释放快捷键和观察者() {
        let collectModel = CollectModel(userID: 7)
        let panel = QuickCollectPanelSpy(model: collectModel)
        let hotKeys = HotKeyRegistrarSpy()
        let lifecycle = ObserverCenterSpy()
        let notifications = CollectNotificationObserverSpy()
        let controller = MenuBarController(
            model: collectModel,
            panel: panel,
            hotKeys: hotKeys,
            observerCenter: lifecycle,
            shortcut: .default,
            notifications: notifications
        )

        controller.start()
        controller.handleAppDidBecomeActive()
        controller.togglePanel()
        controller.stop()

        #expect(!panel.isPresented)
        #expect(hotKeys.registeredShortcuts.isEmpty)
        #expect(lifecycle.addedObserverNames.isEmpty)
        #expect(
            lifecycle.removedObserverNames == [
                NSApplication.didBecomeActiveNotification,
                NSApplication.willTerminateNotification,
            ]
        )
        #expect(notifications.startCount == 1)
        #expect(notifications.stopCount == 1)
    }

    @Test func completedAndFailedJobsProduceNotifications() {
        #expect(CollectNotificationEvent(job: .fixture(status: "completed")) == .completed)
        #expect(CollectNotificationEvent(job: .fixture(status: "failed")) == .failed)
        #expect(CollectNotificationEvent(job: .fixture(status: "running")) == nil)
    }

    @Test func 快速采集必须显式确认链接且编辑后重新确认() {
        let form = QuickCollectFormState()

        form.readFromPasteboard(" https://example.com/article ")
        #expect(!form.canSubmit)

        form.confirmSubmission()
        #expect(form.canSubmit)
        #expect(form.confirmedURL == "https://example.com/article")

        form.editingChanged("https://example.com/changed")
        #expect(!form.canSubmit)
    }

    @Test func 终端任务通知只发送一次并按点击结果路由() async {
        let delivery = NotificationDeliverySpy()
        let routes = NotificationRouteSpy()
        let service = CollectNotificationService(
            delivery: delivery,
            onOpenArticle: { job in
                routes.openedArticleIDs.append(job.articleId ?? -1)
            },
            onOpenTaskList: {
                routes.taskListOpenCount += 1
            }
        )
        let existing = CollectJob.fixture(status: "completed")
        let finished = CollectJob.fixture(id: 12, status: "completed")

        service.prepareExistingJobs([existing])
        await service.synchronizeJobs([existing, finished])
        await service.synchronizeJobs([finished])
        await service.notify(job: CollectJob.fixture(status: "running"))

        let requests = await delivery.requests
        #expect(requests.count == 1)
        #expect(requests[0].identifier == "collect-job-12-completed")
        #expect(requests[0].title == "采集完成")
        #expect(requests[0].categoryIdentifier == "collect.completed")
        #expect(await delivery.authorizationCount == 1)

        await service.handleNotificationActivation(job: finished)
        await service.handleNotificationActivation(job: CollectJob.fixture(status: "failed"))

        #expect(routes.openedArticleIDs == [88])
        #expect(routes.taskListOpenCount == 1)
    }

    @Test func 失败任务重试后完成会再次通知() async {
        let delivery = NotificationDeliverySpy()
        let service = CollectNotificationService(
            delivery: delivery,
            onOpenArticle: { _ in },
            onOpenTaskList: {}
        )
        let retriedJob = CollectJob.fixture(id: 21, status: "failed")

        await service.synchronizeJobs([retriedJob])
        await service.synchronizeJobs([
            CollectJob.fixture(id: 21, status: "pending")
        ])
        await service.synchronizeJobs([
            CollectJob.fixture(id: 21, status: "running")
        ])
        await service.synchronizeJobs([
            CollectJob.fixture(id: 21, status: "completed")
        ])

        let requests = await delivery.requests
        #expect(requests.map(\.categoryIdentifier) == [
            "collect.failed",
            "collect.completed",
        ])
    }

    @Test func 旧账号已送达通知不会打开当前账号内容() async {
        let routes = NotificationRouteSpy()
        let service = CollectNotificationService(
            delivery: NotificationDeliverySpy(),
            currentUserID: 7,
            onOpenArticle: { _ in
                routes.openedArticleIDs.append(88)
            },
            onOpenTaskList: {
                routes.taskListOpenCount += 1
            }
        )

        await service.handleNotificationActivation(
            job: CollectJob.fixture(status: "completed"),
            userID: 8
        )
        await service.handleNotificationActivation(
            job: CollectJob.fixture(status: "failed"),
            userID: 7
        )

        #expect(routes.openedArticleIDs.isEmpty)
        #expect(routes.taskListOpenCount == 1)
    }

    @Test func 开始观察采集模型时立即记录当前账号() async {
        let model = CollectModel(userID: 8)
        let routes = NotificationRouteSpy()
        let service = CollectNotificationService(
            delivery: NotificationDeliverySpy(),
            onOpenArticle: { _ in
                routes.openedArticleIDs.append(88)
            },
            onOpenTaskList: {}
        )

        service.startObserving(model: model)
        await service.handleNotificationActivation(
            job: CollectJob.fixture(status: "completed"),
            userID: 8
        )
        service.stopObserving()

        #expect(routes.openedArticleIDs == [88])
    }

    @Test func 账号切换后立即点击旧通知不会路由() async {
        let model = CollectModel(userID: 8)
        let routes = NotificationRouteSpy()
        let service = CollectNotificationService(
            delivery: NotificationDeliverySpy(),
            onOpenArticle: { _ in
                routes.openedArticleIDs.append(88)
            },
            onOpenTaskList: {
                routes.taskListOpenCount += 1
            }
        )

        service.startObserving(model: model)
        model.prepareUser(userID: 7)
        await service.handleNotificationActivation(
            job: CollectJob.fixture(status: "completed"),
            userID: 8
        )
        service.stopObserving()

        #expect(routes.openedArticleIDs.isEmpty)
        #expect(routes.taskListOpenCount == 0)
    }

    @Test func 关闭主窗口不会退出应用() {
        #expect(
            !AppDelegate().applicationShouldTerminateAfterLastWindowClosed(
                NSApplication.shared
            )
        )
    }

    @Test func 应用前台仍展示采集通知() {
        let service = CollectNotificationService(
            delivery: NotificationDeliverySpy(),
            onOpenArticle: { _ in },
            onOpenTaskList: {}
        )

        #expect(
            service.foregroundPresentationOptions() == [.banner, .sound]
        )
    }
}

private final class QuickCollectPanelSpy: QuickCollectPresenting {
    let model: CollectModel
    var isPresented = false
    private(set) var presentCount = 0

    init(model: CollectModel) {
        self.model = model
    }

    func present(from statusBarButton: NSStatusBarButton?) {
        isPresented = true
        presentCount += 1
    }

    func dismiss() {
        isPresented = false
    }
}

private final class HotKeyRegistrarSpy: HotKeyRegistering {
    enum Event: Equatable {
        case register(GlobalShortcut)
        case unregister
    }

    private(set) var registeredShortcuts: [GlobalShortcut] = []
    private(set) var events: [Event] = []

    func register(_ shortcut: GlobalShortcut) {
        registeredShortcuts.append(shortcut)
        events.append(.register(shortcut))
    }

    func unregister() {
        registeredShortcuts.removeAll()
        events.append(.unregister)
    }
}

private final class CollectNotificationObserverSpy: CollectNotificationObserving {
    private(set) var startCount = 0
    private(set) var stopCount = 0

    func startObserving(model: CollectModel) {
        startCount += 1
    }

    func stopObserving() {
        stopCount += 1
    }
}

private final class ObserverCenterSpy: ObserverCentering {
    private(set) var addedObserverNames: [Notification.Name] = []
    private(set) var removedObserverNames: [Notification.Name] = []

    func addObserver(
        _ observer: NSObject,
        selector: Selector,
        forName name: Notification.Name
    ) -> NSObjectProtocol {
        addedObserverNames.append(name)
        return ObjectToken(name: name)
    }

    func removeObserver(_ token: NSObjectProtocol) {
        guard let token = token as? ObjectToken else { return }
        removedObserverNames.append(token.name)
        addedObserverNames.removeAll { $0 == token.name }
    }

    private final class ObjectToken: NSObject {
        let name: Notification.Name

        init(name: Notification.Name) {
            self.name = name
        }
    }
}

private extension CollectJob {
    static func fixture(id: Int = 11, status: String) -> Self {
        let payload: [String: Any?] = [
            "id": id,
            "url": "https://example.com/article",
            "normalizedUrl": "https://example.com/article",
            "status": status,
            "stage": status,
            "method": "singlefile",
            "captureStrategy": "desktop",
            "articleId": status == "completed" ? 88 : nil,
            "title": status == "completed" ? "已完成文章" : nil,
            "error": status == "failed" ? "采集失败" : nil,
            "errorSummary": status == "failed" ? "采集失败" : nil,
            "errorDetails": [String](),
            "errorHint": nil,
            "createdAt": nil,
            "updatedAt": nil,
            "startedAt": nil,
            "finishedAt": nil,
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        return try! JSONDecoder.qiankunjie.decode(CollectJob.self, from: data)
    }
}

private actor NotificationDeliverySpy: CollectNotificationDelivering {
    private(set) var requests: [CollectNotificationRequest] = []
    private(set) var authorizationCount = 0

    func requestAuthorization() async throws {
        authorizationCount += 1
    }

    func add(_ request: CollectNotificationRequest) async throws {
        requests.append(request)
    }
}

@MainActor
private final class NotificationRouteSpy {
    var openedArticleIDs: [Int] = []
    var taskListOpenCount = 0
}
