import AppKit
import QiankunjieCollect

enum MenuBarState: Equatable {
    case guest
    case authenticated
}

struct MenuBarActions {
    let openSettings: () -> Void
    let checkForUpdates: () -> Void
    let reportIssue: () -> Void
    let about: () -> Void
    let quit: () -> Void

    @MainActor static let noop = MenuBarActions(
        openSettings: {},
        checkForUpdates: {},
        reportIssue: {},
        about: {},
        quit: {}
    )
}

@MainActor
protocol ObserverCentering: AnyObject {
    func addObserver(
        _ observer: NSObject,
        selector: Selector,
        forName name: Notification.Name
    ) -> NSObjectProtocol
    func removeObserver(_ token: NSObjectProtocol)
}

@MainActor
private final class AppObserverCenter: ObserverCentering {
    func addObserver(
        _ observer: NSObject,
        selector: Selector,
        forName name: Notification.Name
    ) -> NSObjectProtocol {
        NotificationCenter.default.addObserver(
            observer,
            selector: selector,
            name: name,
            object: nil
        )
        return observer
    }

    func removeObserver(_ token: NSObjectProtocol) {
        NotificationCenter.default.removeObserver(token)
    }
}

@MainActor
public final class MenuBarController: NSObject {
    private let model: CollectModel
    private let panel: any QuickCollectPresenting
    private let hotKeys: any HotKeyRegistering
    private let observerCenter: any ObserverCentering
    private let notifications: (any CollectNotificationObserving)?
    private let actions: MenuBarActions
    private(set) var shortcut: GlobalShortcut
    private var statusItem: NSStatusItem?
    private var statusMenu: NSMenu?
    private var observerToken: NSObjectProtocol?
    private var terminationObserverToken: NSObjectProtocol?
    private var isStarted = false
    private(set) var state: MenuBarState = .guest
    private(set) var hotKeyRegistrationMessage: String?

    init(
        model: CollectModel,
        panel: any QuickCollectPresenting,
        hotKeys: any HotKeyRegistering,
        observerCenter: any ObserverCentering,
        shortcut: GlobalShortcut,
        notifications: (any CollectNotificationObserving)? = nil,
        actions: MenuBarActions? = nil
    ) {
        self.model = model
        self.panel = panel
        self.hotKeys = hotKeys
        self.observerCenter = observerCenter
        self.notifications = notifications
        self.actions = actions ?? .noop
        self.shortcut = shortcut
        super.init()
        refreshState()
    }

    convenience init(
        model: CollectModel,
        shortcut: GlobalShortcut = .default,
        onOpenMainWindow: @escaping @MainActor () -> Void,
        notifications: (any CollectNotificationObserving)? = nil,
        actions: MenuBarActions? = nil
    ) {
        let panel = QuickCollectPanel(
            model: model,
            onOpenMainWindow: onOpenMainWindow
        )
        self.init(
            model: model,
            panel: panel,
            hotKeys: GlobalHotKeyManager { [weak panel] in
                panel?.present(from: nil)
            },
            observerCenter: AppObserverCenter(),
            shortcut: shortcut,
            notifications: notifications,
            actions: actions
        )
    }

    convenience init(
        appModel: AppModel,
        shortcut: GlobalShortcut = .default,
        onShowMainWindow: @escaping @MainActor () -> Void,
        actions: MenuBarActions? = nil
    ) {
        let panel = QuickCollectPanel(
            model: appModel.collectModel,
            authModel: appModel.authModel,
            onAuthenticated: { [weak appModel] in
                appModel?.didAuthenticate()
            },
            onOpenMainWindow: onShowMainWindow
        )
        let notificationService = CollectNotificationService(
            onOpenArticle: { [weak appModel] job in
                appModel?.openCollectArticle(job)
                onShowMainWindow()
            },
            onOpenTaskList: { [weak appModel] in
                appModel?.selectDestination(.collect)
                onShowMainWindow()
            }
        )
        self.init(
            model: appModel.collectModel,
            panel: panel,
            hotKeys: GlobalHotKeyManager { [weak panel] in
                panel?.present(from: nil)
            },
            observerCenter: AppObserverCenter(),
            shortcut: shortcut,
            notifications: notificationService,
            actions: actions
        )
    }

    func start() {
        guard !isStarted else { return }
        isStarted = true

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let menuBarIcon = NSImage(named: "MenuBarCollectIcon")
        menuBarIcon?.isTemplate = false
        menuBarIcon?.size = NSSize(width: 18, height: 18)
        item.button?.image = menuBarIcon
        item.button?.target = self
        item.button?.action = #selector(togglePanelFromStatusItem)
        item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        statusMenu = makeStatusMenu()
        statusItem = item

        observerToken = observerCenter.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            forName: NSApplication.didBecomeActiveNotification
        )
        terminationObserverToken = observerCenter.addObserver(
            self,
            selector: #selector(appWillTerminate),
            forName: NSApplication.willTerminateNotification
        )
        if !hotKeys.register(shortcut) {
            hotKeyRegistrationMessage = "全局快捷键注册失败，快捷键当前不可用。"
        }
        notifications?.startObserving(model: model)
        refreshState()
    }

    func stop() {
        panel.dismiss()
        hotKeys.unregister()

        if let observerToken {
            observerCenter.removeObserver(observerToken)
            self.observerToken = nil
        }
        if let terminationObserverToken {
            observerCenter.removeObserver(terminationObserverToken)
            self.terminationObserverToken = nil
        }
        if let statusItem {
            statusItem.button?.target = nil
            NSStatusBar.system.removeStatusItem(statusItem)
            self.statusItem = nil
        }
        statusMenu = nil
        isStarted = false
        notifications?.stopObserving()
    }

    func togglePanel() {
        panel.toggleFromStatusItem(statusItem?.button)
    }

    var statusMenuTitles: [String] {
        statusMenu?.items.map(\.title) ?? []
    }

    @discardableResult
    func performStatusMenuAction(at index: Int) -> Bool {
        guard
            let item = statusMenu?.item(at: index),
            let action = item.action
        else {
            return false
        }
        return NSApp.sendAction(action, to: item.target, from: item)
    }

    @discardableResult
    func updateShortcut(_ shortcut: GlobalShortcut) -> Bool {
        guard shortcut != self.shortcut else { return true }

        if isStarted {
            hotKeys.unregister()
            let previousShortcut = self.shortcut
            if hotKeys.register(shortcut) {
                hotKeyRegistrationMessage = nil
            } else {
                hotKeys.register(previousShortcut)
                hotKeyRegistrationMessage = "全局快捷键注册失败，已保留原快捷键。"
                return false
            }
        }
        self.shortcut = shortcut
        refreshState()
        return true
    }

    func handleAppDidBecomeActive() {
        refreshState()
        if model.userID != nil {
            Task {
                await model.refreshJobs()
            }
        }
    }

    private func refreshState() {
        state = model.userID == nil ? .guest : .authenticated
        statusItem?.button?.toolTip = state == .authenticated
            ? "乾坤戒快速采集（\(shortcut.displayName)）"
            : "乾坤戒（登录后可采集）"
    }

    @objc private func appDidBecomeActive() {
        MainActor.assumeIsolated {
            handleAppDidBecomeActive()
        }
    }

    @objc private func appWillTerminate() {
        MainActor.assumeIsolated {
            stop()
        }
    }

    @objc private func togglePanelFromStatusItem() {
        MainActor.assumeIsolated {
            if NSApp.currentEvent?.type == .rightMouseUp {
                showStatusMenu()
            } else {
                togglePanel()
            }
        }
    }

    private func makeStatusMenu() -> NSMenu {
        let menu = NSMenu()
        menu.addItem(statusMenuItem(title: "设置", action: #selector(openSettingsFromMenu)))
        menu.addItem(statusMenuItem(title: "检测更新", action: #selector(checkForUpdatesFromMenu)))
        menu.addItem(statusMenuItem(title: "提交问题", action: #selector(reportIssueFromMenu)))
        menu.addItem(statusMenuItem(title: "关于 乾坤戒", action: #selector(showAboutFromMenu)))
        menu.addItem(statusMenuItem(title: "退出", action: #selector(quitFromMenu)))
        return menu
    }

    private func statusMenuItem(title: String, action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        return item
    }

    private func showStatusMenu() {
        panel.dismiss()
        guard let button = statusItem?.button, let statusMenu else { return }
        statusMenu.popUp(
            positioning: nil,
            at: NSPoint(x: 0, y: button.bounds.height + 4),
            in: button
        )
    }

    @objc private func openSettingsFromMenu() {
        MainActor.assumeIsolated { actions.openSettings() }
    }

    @objc private func checkForUpdatesFromMenu() {
        MainActor.assumeIsolated { actions.checkForUpdates() }
    }

    @objc private func reportIssueFromMenu() {
        MainActor.assumeIsolated { actions.reportIssue() }
    }

    @objc private func quitFromMenu() {
        MainActor.assumeIsolated { actions.quit() }
    }

    @objc private func showAboutFromMenu() {
        MainActor.assumeIsolated { actions.about() }
    }
}
