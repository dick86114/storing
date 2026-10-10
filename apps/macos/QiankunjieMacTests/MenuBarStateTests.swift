import AppKit
import Foundation
import QiankunjieCore
import UserNotifications
@testable import QiankunjieCollect
@testable import QiankunjieMac
import Testing

@MainActor
struct MenuBarStateTests {
    @Test func 右键菜单按固定顺序提供打开主窗口和操作() {
        let model = CollectModel(userID: 7)
        let controller = MenuBarController(
            model: model,
            panel: QuickCollectPanelSpy(model: model),
            hotKeys: HotKeyRegistrarSpy(),
            observerCenter: ObserverCenterSpy(),
            shortcut: .default
        )

        controller.start()

        #expect(controller.statusMenuTitles == ["打开主窗口", "设置", "检测更新", "提交问题", "关于 乾坤戒", "退出"])
    }

    @Test func 右键菜单操作调用对应回调并打开主窗口() {
        let model = CollectModel(userID: 7)
        var events: [String] = []
        let panel = QuickCollectPanelSpy(model: model)
        let actions = MenuBarActions(
            openMainWindow: { events.append("打开主窗口") },
            openSettings: { events.append("设置") },
            checkForUpdates: { events.append("检测更新") },
            reportIssue: { events.append("提交问题") },
            about: { events.append("关于 乾坤戒") },
            quit: { events.append("退出") }
        )
        let controller = MenuBarController(
            model: model,
            panel: panel,
            hotKeys: HotKeyRegistrarSpy(),
            observerCenter: ObserverCenterSpy(),
            shortcut: .default,
            actions: actions
        )

        controller.start()
        panel.present(from: nil)
        #expect(panel.isPresented)
        #expect(controller.performStatusMenuAction(at: 0))
        #expect(!panel.isPresented)
        for index in 1..<controller.statusMenuTitles.count {
            #expect(controller.performStatusMenuAction(at: index))
        }
        #expect(events == ["打开主窗口", "设置", "检测更新", "提交问题", "关于 乾坤戒", "退出"])
    }

    @Test func 关闭最后一个普通窗口后隐藏Dock() {
        let mainWindow = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        let anotherWindow = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )

        #expect(AppDelegate.shouldHideDock(
            afterClosing: mainWindow,
            otherVisibleWindows: []
        ))
        #expect(!AppDelegate.shouldHideDock(
            afterClosing: mainWindow,
            otherVisibleWindows: [anotherWindow]
        ))
    }

    @Test func 关闭快速采集面板不会隐藏Dock() {
        let panel = NSPanel(
            contentRect: .zero,
            styleMask: [.titled, .closable, .utilityWindow],
            backing: .buffered,
            defer: false
        )

        #expect(!AppDelegate.shouldHideDock(afterClosing: panel, otherVisibleWindows: []))
    }

    @Test func 菜单栏图标窗口不会阻止关闭主窗口后隐藏Dock() {
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        defer { NSStatusBar.system.removeStatusItem(statusItem) }

        let mainWindow = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        // 菜单栏图标会一直保留一个可见的 NSStatusBarWindow，它不该算作「还有普通窗口」。
        let statusBarWindows = NSApp.windows.filter {
            $0.isVisible && $0.className == "NSStatusBarWindow"
        }

        #expect(!statusBarWindows.isEmpty)
        #expect(AppDelegate.shouldHideDock(
            afterClosing: mainWindow,
            otherVisibleWindows: statusBarWindows
        ))
    }

    @Test func 关闭主窗口后应用切换为后台运行() {
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        defer { NSStatusBar.system.removeStatusItem(statusItem) }

        let delegate = AppDelegate()
        delegate.applicationDidFinishLaunching(
            Notification(name: NSApplication.didFinishLaunchingNotification, object: NSApp)
        )
        defer { delegate.applicationWillTerminate(
            Notification(name: NSApplication.willTerminateNotification, object: NSApp)
        ) }

        let mainWindow = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        mainWindow.orderFront(nil)
        defer { mainWindow.orderOut(nil) }

        // 测试宿主可能自带窗口，先隐藏掉，只留主窗口和菜单栏图标两条路径。
        let backgroundWindows = NSApp.windows.filter {
            $0 !== mainWindow && $0.className != "NSStatusBarWindow"
        }
        let restoreWindows = backgroundWindows.map { ($0, $0.isVisible) }
        for window in backgroundWindows {
            window.orderOut(nil)
        }
        defer {
            for (window, wasVisible) in restoreWindows where wasVisible {
                window.orderFront(nil)
            }
        }

        let previousPolicy = NSApp.activationPolicy()
        NSApp.setActivationPolicy(.regular)
        defer { NSApp.setActivationPolicy(previousPolicy) }

        NotificationCenter.default.post(
            name: NSWindow.willCloseNotification,
            object: mainWindow
        )

        #expect(NSApp.activationPolicy() == .accessory)
    }

    @Test func 菜单栏区域的点击不会被当成点面板外面() {
        guard let screen = NSScreen.screens.first else { return }

        func mouseEvent(at point: NSPoint) -> NSEvent? {
            NSEvent.mouseEvent(
                with: .leftMouseDown,
                location: point,
                modifierFlags: [],
                timestamp: 0,
                windowNumber: 0,
                context: nil,
                eventNumber: 0,
                clickCount: 1,
                pressure: 1
            )
        }

        // 菜单栏在 visibleFrame 上方：这里属于点图标，不能收起面板。
        let menuBarEvent = mouseEvent(
            at: NSPoint(x: screen.frame.midX, y: screen.visibleFrame.maxY + 2)
        )
        #expect(menuBarEvent.map(QuickCollectPanel.isMenuBarClick) == true)

        // 桌面区域仍算点面板外面。
        let desktopEvent = mouseEvent(
            at: NSPoint(x: screen.frame.midX, y: screen.visibleFrame.midY)
        )
        #expect(desktopEvent.map(QuickCollectPanel.isMenuBarClick) == false)
    }

    @Test func 系统菜单窗口中的点击不会关闭快速采集面板() {
        guard let screen = NSScreen.screens.first else { return }

        let menuWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1, height: 1),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        let menuEvent = NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: menuWindow.convertPoint(toScreen: NSPoint(x: 0, y: 0)),
            modifierFlags: [],
            timestamp: 0,
            windowNumber: menuWindow.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1
        )

        #expect(
            menuEvent.map {
                QuickCollectPanel.shouldDismissOutsideClick(
                    $0,
                    windowClassName: "NSMenuWindowManagerWindow"
                )
            } == false
        )
        #expect(
            QuickCollectPanel.shouldDismissOutsideClick(
                menuEvent!,
                windowClassName: nil
            )
        )
        #expect(screen.frame.midX > 0)
    }

    @Test func 快速采集弹窗展示时不会激活输入框() {
        let model = CollectModel(userID: 7)
        let panel = QuickCollectPanel(model: model) {}

        panel.present(from: nil)
        defer { panel.dismiss() }

        #expect(panel.isVisible)
        #expect(panel.styleMask.contains(.nonactivatingPanel))
        #expect(NSApp.keyWindow !== panel)
    }

    @Test func 输入框激活后外部点击不再自动关闭面板() {
        guard let screen = NSScreen.screens.first else { return }
        let panel = QuickCollectPanel(model: CollectModel(userID: 7)) {}
        let desktopEvent = NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: NSPoint(x: screen.frame.midX, y: screen.visibleFrame.midY),
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1
        )

        panel.handleInputFocusChange(true)
        panel.handleInputFocusChange(false)
        #expect(
            desktopEvent.map {
                QuickCollectPanel.shouldDismissOutsideClick(
                    $0,
                    isInputSessionActive: true
                )
            } == false
        )
    }

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

    @Test func 快捷键注册失败保留旧组合并给出提示() {
        let collectModel = CollectModel(userID: 7)
        let hotKeys = HotKeyRegistrarSpy(failingShortcut: .shiftCommandS)
        let controller = MenuBarController(
            model: collectModel,
            panel: QuickCollectPanelSpy(model: collectModel),
            hotKeys: hotKeys,
            observerCenter: ObserverCenterSpy(),
            shortcut: .default
        )

        controller.start()
        let changed = controller.updateShortcut(.shiftCommandS)

        #expect(!changed)
        #expect(controller.shortcut == .default)
        #expect(hotKeys.registeredShortcuts == [.default])
        #expect(controller.hotKeyRegistrationMessage == "全局快捷键注册失败，已保留原快捷键。")
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

    @Test func 快速采集输入链接后可以直接提交且编辑保留可提交状态() {
        let form = QuickCollectFormState()

        form.readFromPasteboard(" https://example.com/article ")
        #expect(form.canSubmit)
        #expect(form.confirmedURL == "https://example.com/article")

        form.confirmSubmission()
        #expect(form.canSubmit)
        #expect(form.confirmedURL == "https://example.com/article")

        form.editingChanged("https://example.com/changed")
        #expect(form.canSubmit)
        #expect(form.confirmedURL == "https://example.com/changed")
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
    private let failingShortcut: GlobalShortcut?

    init(failingShortcut: GlobalShortcut? = nil) {
        self.failingShortcut = failingShortcut
    }

    @discardableResult
    func register(_ shortcut: GlobalShortcut) -> Bool {
        events.append(.register(shortcut))
        let succeeded = shortcut != failingShortcut
        if succeeded {
            registeredShortcuts.append(shortcut)
        }
        return succeeded
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
