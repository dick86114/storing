import AppKit
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

@MainActor
protocol QuickCollectPresenting: AnyObject {
    var model: CollectModel { get }
    var isPresented: Bool { get }

    func present(from statusBarButton: NSStatusBarButton?)
    func dismiss()
    func toggleFromStatusItem(_ statusBarButton: NSStatusBarButton?)
}

extension QuickCollectPresenting {
    /// 默认实现：按当前可见状态切换。
    func toggleFromStatusItem(_ statusBarButton: NSStatusBarButton?) {
        if isPresented {
            dismiss()
        } else {
            present(from: statusBarButton)
        }
    }
}

@MainActor
final class QuickCollectPanel: NSPanel, QuickCollectPresenting {
    let model: CollectModel
    let authModel: AuthModel?
    let onAuthenticated: @MainActor () -> Void
    private var onOpenMainWindow: @MainActor () -> Void
    private var outsideClickMonitor: Any?
    private var localClickMonitor: Any?
    /// 菜单栏图标按下瞬间的面板状态。按钮 action 要等鼠标抬起才触发，
    /// 期间面板可能已经被隐藏，直接读 `isVisible` 会把「收起」误判成「打开」。
    private var statusItemPressStartedVisible: Bool?

    var isPresented: Bool { isVisible }

    /// 无标题栏面板默认不能成为 key window，输入框会拿不到键盘焦点。
    override var canBecomeKey: Bool { true }

    init(
        model: CollectModel,
        authModel: AuthModel? = nil,
        onAuthenticated: @escaping @MainActor () -> Void = {},
        onOpenMainWindow: @escaping @MainActor () -> Void
    ) {
        self.model = model
        self.authModel = authModel
        self.onAuthenticated = onAuthenticated
        self.onOpenMainWindow = onOpenMainWindow

        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 420),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        level = .floating
        isFloatingPanel = true
        hidesOnDeactivate = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        animationBehavior = .utilityWindow
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        self.onOpenMainWindow = { [weak self] in
            self?.dismiss()
            onOpenMainWindow()
        }
        contentView = NSHostingController(
            rootView: QuickCollectView(
                model: model,
                authModel: authModel,
                onAuthenticated: onAuthenticated,
                onOpenMainWindow: self.onOpenMainWindow
            )
        ).view
    }

    func present(from statusBarButton: NSStatusBarButton?) {
        statusItemPressStartedVisible = nil
        if let statusBarButton,
            let buttonFrame = statusBarButton.window?.convertToScreen(
                statusBarButton.convert(statusBarButton.bounds, to: nil)
            )
        {
            let origin = NSPoint(
                x: buttonFrame.midX - frame.width / 2,
                y: buttonFrame.minY - frame.height
            )
            setFrameOrigin(origin)
        } else if frame.origin == .zero {
            center()
        }
        NSApp.activate(ignoringOtherApps: true)
        makeKeyAndOrderFront(nil)
        installOutsideClickMonitor()
    }

    func dismiss() {
        statusItemPressStartedVisible = nil
        removeOutsideClickMonitor()
        guard isVisible else { return }
        orderOut(nil)
    }

    func toggleFromStatusItem(_ statusBarButton: NSStatusBarButton?) {
        let wasPresented = statusItemPressStartedVisible ?? isVisible
        statusItemPressStartedVisible = nil
        if wasPresented {
            dismiss()
        } else {
            present(from: statusBarButton)
        }
    }

    /// 点面板之外立刻隐藏。
    ///
    /// 全局监视器负责其他应用；本应用内的点击用本地监视器处理。
    /// 两种监视器都放过菜单栏图标自身，否则点击图标时会先被关掉，
    /// 按钮 action 再看到面板已隐藏，就变成「关不掉、只会重新弹」。
    /// 面板不再随失去焦点自动隐藏，这样再次点击图标才能走到收起分支。
    private func installOutsideClickMonitor() {
        guard outsideClickMonitor == nil else { return }
        outsideClickMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown]
        ) { [weak self] event in
            guard !MainActor.assumeIsolated({ Self.isMenuBarClick(event) }) else { return }
            Task { @MainActor in
                self?.dismiss()
            }
        }
        localClickMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown]
        ) { [weak self] event in
            let shouldDismiss = MainActor.assumeIsolated { () -> Bool in
                guard let self else { return false }
                guard !Self.isMenuBarClick(event) else {
                    self.statusItemPressStartedVisible = self.isPresented
                    return false
                }
                return event.window !== self
            }
            if shouldDismiss {
                Task { @MainActor in
                    self?.dismiss()
                }
            }
            return event
        }
    }

    private func removeOutsideClickMonitor() {
        if let outsideClickMonitor {
            NSEvent.removeMonitor(outsideClickMonitor)
            self.outsideClickMonitor = nil
        }
        if let localClickMonitor {
            NSEvent.removeMonitor(localClickMonitor)
            self.localClickMonitor = nil
        }
    }

    /// 点击菜单栏区域属于「再点一次图标」，不能当成点了面板外面。
    ///
    /// 本地事件能拿到状态栏窗口；全局事件的 `window` 为空，只能按屏幕位置判断——
    /// 菜单栏位于屏幕 `visibleFrame` 之上。
    static func isMenuBarClick(_ event: NSEvent) -> Bool {
        if event.window?.className == statusBarWindowClassName {
            return true
        }
        // 全局监视器收到的 `locationInWindow` 就是屏幕坐标。
        let location = event.window.map { $0.convertPoint(toScreen: event.locationInWindow) }
            ?? event.locationInWindow
        return NSScreen.screens.contains { screen in
            screen.frame.contains(location) && location.y >= screen.visibleFrame.maxY
        }
    }

    private static let statusBarWindowClassName = "NSStatusBarWindow"
}

@Observable
@MainActor
final class QuickCollectFormState {
    var urlDraft = ""
    var isConfirmed = false
    var confirmedURL = ""

    var trimmedURL: String {
        urlDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var canConfirm: Bool {
        !trimmedURL.isEmpty
    }

    var canSubmit: Bool {
        canConfirm
    }

    func readFromPasteboard(_ value: String?) {
        guard let value else { return }
        urlDraft = value
        confirmedURL = trimmedURL
    }

    func confirmSubmission() {
        guard canConfirm else {
            isConfirmed = false
            confirmedURL = ""
            return
        }
        confirmedURL = trimmedURL
        isConfirmed = true
    }

    func editingChanged(_ value: String) {
        urlDraft = value
        confirmedURL = trimmedURL
    }

    func readSystemPasteboard(_ pasteboard: NSPasteboard) {
        readFromPasteboard(pasteboard.string(forType: .string))
    }
}

private struct QuickCollectView: View {
    @Bindable var model: CollectModel
    let authModel: AuthModel?
    let onAuthenticated: @MainActor () -> Void
    let onOpenMainWindow: @MainActor () -> Void
    @State private var form = QuickCollectFormState()
    @State private var isLoginPresented = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("快速采集")
                    .qiankunjieFont(.headlineSmall)
                    .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
                Spacer()
                Button {
                    onOpenMainWindow()
                } label: {
                    Label("打开主窗口", systemImage: "macwindow")
                }
            }

            if model.userID == nil {
                loginPrompt {
                    isLoginPresented = true
                }
            } else {
                collectForm
            }

            Divider()

            recentJob
        }
        .padding(18)
        .frame(width: 420, height: 420)
        .background(QiankunjieColors.background(for: colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .overlay {
            if isLoginPresented, let authModel {
                ZStack {
                    Rectangle()
                        .fill(.black.opacity(0.46))
                        .contentShape(Rectangle())
                        .onTapGesture { isLoginPresented = false }

                    LoginView(
                        authModel: authModel,
                        onAuthenticated: {
                            if let userID = authModel.user?.id {
                                model.prepareUser(userID: userID)
                            }
                            onAuthenticated()
                            isLoginPresented = false
                            Task { await submitSavedURL() }
                        },
                        onCancel: { isLoginPresented = false }
                    )
                    .onTapGesture {}
                }
                .transition(.opacity)
            }
        }
    }

    private func loginPrompt(onLogin: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("登录后才能采集网页", systemImage: "person.badge.key")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
            Button {
                onLogin()
            } label: {
                Label("登录后继续采集", systemImage: "person.badge.key")
            }
            .buttonStyle(.borderedProminent)
            Text("登录成功后会自动提交当前链接。")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var collectForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField(
                "粘贴公开网页链接",
                text: Binding(
                    get: { form.urlDraft },
                    set: form.editingChanged
                )
            )
            .textFieldStyle(.roundedBorder)
            .autocorrectionDisabled()
            .disabled(model.isSubmitting)
            .accessibilityLabel("网页链接")

            HStack {
                Button {
                    form.readSystemPasteboard(NSPasteboard.general)
                } label: {
                    Label("读取剪贴板", systemImage: "doc.on.clipboard")
                }
                .disabled(model.isSubmitting)

                Spacer()

                Button(action: submit) {
                    HStack(spacing: 6) {
                        if model.isSubmitting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "plus.rectangle.on.rectangle")
                        }
                        Text(model.isSubmitting ? "正在提交" : "采集")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!form.canSubmit || model.isSubmitting)
            }

            errorMessages
        }
    }

    @ViewBuilder
    private var errorMessages: some View {
        if let message = model.inputErrorMessage ?? model.submitErrorMessage {
            Text(message)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
        }
    }

    private var recentJob: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("最近任务")
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

            if let job = model.currentJob {
                CollectJobRow(job: job, isMutating: false)
            } else {
                Text("暂无任务")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func submit() {
        guard form.canSubmit, !model.isSubmitting else { return }

        let url = form.confirmedURL
        Task {
            await model.submit(url)
            if model.submitErrorMessage == "登录已失效，请重新登录" {
                isLoginPresented = true
            }
            if model.submitErrorMessage == nil {
                form.urlDraft = ""
                form.confirmedURL = ""
            }
        }
    }

    private func submitSavedURL() async {
        guard form.canSubmit else { return }
        let url = form.confirmedURL
        await model.submit(url)
        if model.submitErrorMessage == nil {
            form.urlDraft = ""
            form.confirmedURL = ""
        }
    }
}
