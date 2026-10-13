import AppKit
import QiankunjieCollect
import QiankunjieDesignSystem
import SwiftUI

/// 从「采集」按钮浮出的快速采集弹窗：只有一个输入框和几个按钮。
struct CollectQuickPopoverView: View {
    @Bindable var model: CollectModel
    /// 未登录时点击「登录」：关闭弹窗并打开登录面板。
    var onRequestLogin: () -> Void = {}
    /// 提交成功后关闭弹窗。
    var onFinished: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var isURLFocused: Bool
    @State private var didSubmit = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if model.userID == nil {
                loginRequired
            } else if didSubmit {
                submitted
            } else {
                form
            }
        }
        .padding(16)
        .frame(width: 332)
        .onAppear {
            isURLFocused = model.userID != nil
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("粘贴公开网页链接", text: $model.urlDraft)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .focused($isURLFocused)
                .disabled(model.isSubmitting)
                .accessibilityLabel("网页链接")
                .onSubmit(submit)

            HStack(spacing: 8) {
                Button {
                    readFromPasteboard()
                } label: {
                    Label("读取剪贴板", systemImage: "doc.on.clipboard")
                }
                .disabled(model.isSubmitting)

                Spacer(minLength: 0)

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
                .disabled(!model.canSubmit)
            }

            if let message = model.inputErrorMessage ?? model.submitErrorMessage {
                Text(message)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
                    .lineLimit(2)
            }
        }
    }

    private var submitted: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
            Text("已提交，正在后台采集")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var loginRequired: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("登录后才能采集网页", systemImage: "person.badge.key")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

            Button("登录", action: onRequestLogin)
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func readFromPasteboard() {
        guard let value = NSPasteboard.general.string(forType: .string) else { return }
        model.urlDraft = value
        isURLFocused = true
    }

    private func submit() {
        guard model.canSubmit else { return }

        let draft = model.urlDraft
        Task {
            await model.submit(draft)
            guard model.inputErrorMessage == nil, model.submitErrorMessage == nil else { return }

            didSubmit = true
            try? await Task.sleep(for: .milliseconds(700))
            onFinished()
        }
    }
}
