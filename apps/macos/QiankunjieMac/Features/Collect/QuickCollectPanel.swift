import AppKit
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
}

@MainActor
final class QuickCollectPanel: NSPanel, QuickCollectPresenting, NSWindowDelegate {
    let model: CollectModel
    private let onOpenMainWindow: @MainActor () -> Void

    var isPresented: Bool { isVisible }

    init(
        model: CollectModel,
        onOpenMainWindow: @escaping @MainActor () -> Void
    ) {
        self.model = model
        self.onOpenMainWindow = onOpenMainWindow

        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 420),
            styleMask: [.titled, .closable, .utilityWindow],
            backing: .buffered,
            defer: false
        )

        title = "快速采集"
        level = .floating
        isFloatingPanel = true
        hidesOnDeactivate = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        animationBehavior = .utilityWindow
        delegate = self
        contentView = NSHostingController(
            rootView: QuickCollectView(
                model: model,
                onOpenMainWindow: onOpenMainWindow
            )
        ).view
    }

    func present(from statusBarButton: NSStatusBarButton?) {
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
    }

    func dismiss() {
        orderOut(nil)
    }
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
        isConfirmed && !confirmedURL.isEmpty
    }

    func readFromPasteboard(_ value: String?) {
        guard let value else { return }
        urlDraft = value
        isConfirmed = false
        confirmedURL = ""
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
        isConfirmed = false
        confirmedURL = ""
    }

    func readSystemPasteboard(_ pasteboard: NSPasteboard) {
        readFromPasteboard(pasteboard.string(forType: .string))
    }
}

private struct QuickCollectView: View {
    @Bindable var model: CollectModel
    let onOpenMainWindow: @MainActor () -> Void
    @State private var form = QuickCollectFormState()
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
                loginPrompt
            } else {
                collectForm
            }

            Divider()

            recentJob
        }
        .padding(18)
        .frame(width: 420, height: 420)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var loginPrompt: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("登录后才能采集网页", systemImage: "person.badge.key")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
            Text("可以在主窗口完成登录，采集状态会在这里同步显示。")
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

            if form.canConfirm {
                VStack(alignment: .leading, spacing: 6) {
                    Text("确认提交这个链接：")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    Text(form.trimmedURL)
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)
                    Toggle("我确认提交以上链接", isOn: confirmationBinding)
                        .disabled(model.isSubmitting)
                }
            }

            errorMessages
        }
    }

    private var confirmationBinding: Binding<Bool> {
        Binding(
            get: { form.isConfirmed },
            set: { value in
                if value {
                    form.confirmSubmission()
                } else {
                    form.isConfirmed = false
                    form.confirmedURL = ""
                }
            }
        )
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
            form.isConfirmed = false
            form.confirmedURL = ""
        }
    }
}
