import AppKit
import QiankunjieCollect

enum MenuBarState: Equatable {
    case guest
    case authenticated
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
    private(set) var shortcut: GlobalShortcut
    private var statusItem: NSStatusItem?
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
        notifications: (any CollectNotificationObserving)? = nil
    ) {
        self.model = model
        self.panel = panel
        self.hotKeys = hotKeys
        self.observerCenter = observerCenter
        self.notifications = notifications
        self.shortcut = shortcut
        super.init()
        refreshState()
    }

    convenience init(
        model: CollectModel,
        shortcut: GlobalShortcut = .default,
        onOpenMainWindow: @escaping @MainActor () -> Void,
        notifications: (any CollectNotificationObserving)? = nil
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
            notifications: notifications
        )
    }

    convenience init(
        appModel: AppModel,
        shortcut: GlobalShortcut = .default,
        onShowMainWindow: @escaping @MainActor () -> Void
    ) {
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
            shortcut: shortcut,
            onOpenMainWindow: onShowMainWindow,
            notifications: notificationService
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
        isStarted = false
        notifications?.stopObserving()
    }

    func togglePanel() {
        if panel.isPresented {
            panel.dismiss()
        } else {
            panel.present(from: statusItem?.button)
        }
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
            togglePanel()
        }
    }
}
