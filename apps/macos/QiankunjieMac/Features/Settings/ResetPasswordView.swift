import QiankunjieDesignSystem
import SwiftUI

struct ResetPasswordView: View {
    let client: ManagementAPIClient
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmation = ""
    @State private var showsCurrentPassword = false
    @State private var showsNewPassword = false
    @State private var showsConfirmation = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var didSave = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                passwordPanel
                feedback
                actions
            }
            .padding(.horizontal, 36)
            .padding(.vertical, 32)
            .frame(maxWidth: 680, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(QiankunjieColors.background(for: colorScheme))
        .navigationTitle("重置密码")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("重置密码")
                .font(.system(size: 26, weight: .semibold, design: .serif))
                .foregroundStyle(WorkspacePalette.primary(for: colorScheme))

            Text("输入当前密码并设置一个新密码。更新后，移动端登录会失效。")
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var passwordPanel: some View {
        VStack(spacing: 0) {
            passwordField(
                title: "当前密码",
                placeholder: "输入当前密码",
                text: $currentPassword,
                isVisible: $showsCurrentPassword
            )

            Divider()

            passwordField(
                title: "新密码",
                placeholder: "至少 12 个字符",
                text: $newPassword,
                isVisible: $showsNewPassword
            )

            Divider()

            passwordField(
                title: "确认新密码",
                placeholder: "再次输入新密码",
                text: $confirmation,
                isVisible: $showsConfirmation
            )
        }
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: QiankunjieRadius.panel))
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func passwordField(
        title: String,
        placeholder: String,
        text: Binding<String>,
        isVisible: Binding<Bool>
    ) -> some View {
        HStack(alignment: .center, spacing: 20) {
            Text(title)
                .font(.callout.weight(.medium))
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .frame(width: 92, alignment: .leading)

            Group {
                if isVisible.wrappedValue {
                    TextField(placeholder, text: text)
                } else {
                    SecureField(placeholder, text: text)
                }
            }
            .textFieldStyle(.plain)
            .font(.body)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(QiankunjieColors.background(for: colorScheme), in: RoundedRectangle(cornerRadius: QiankunjieRadius.control))
            .overlay {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }

            Button {
                isVisible.wrappedValue.toggle()
            } label: {
                Image(systemName: isVisible.wrappedValue ? "eye.slash" : "eye")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .help(isVisible.wrappedValue ? "隐藏密码" : "显示密码")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }

    @ViewBuilder
    private var feedback: some View {
        if let errorMessage {
            inlineMessage(errorMessage, systemImage: "exclamationmark.triangle.fill", color: .red)
        } else if didSave {
            inlineMessage("密码已更新，后续登录请使用新密码。", systemImage: "checkmark.circle.fill", color: .green)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                requirement("至少 12 个字符", satisfied: newPassword.count >= 12)
                requirement("新密码不能与当前密码相同", satisfied: !newPassword.isEmpty && newPassword != currentPassword)
                requirement("两次输入的新密码一致", satisfied: !confirmation.isEmpty && newPassword == confirmation)
            }
            .padding(.horizontal, 2)
        }
    }

    private func inlineMessage(_ message: String, systemImage: String, color: Color) -> some View {
        Label(message, systemImage: systemImage)
            .font(.callout)
            .foregroundStyle(color)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: QiankunjieRadius.control))
    }

    private func requirement(_ title: String, satisfied: Bool) -> some View {
        Label {
            Text(title)
                .foregroundStyle(
                    satisfied
                        ? QiankunjieColors.onSurface(for: colorScheme)
                        : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                )
        } icon: {
            Image(systemName: satisfied ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(satisfied ? .green : QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .font(.caption)
    }

    private var actions: some View {
        HStack {
            Button("取消") {
                dismiss()
            }
            .keyboardShortcut(.cancelAction)

            Spacer()

            Button {
                Task { await submit() }
            } label: {
                if isSaving {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在更新")
                    }
                } else {
                    Text(didSave ? "返回" : "更新密码")
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(WorkspacePalette.primary(for: colorScheme))
            .keyboardShortcut(.defaultAction)
            .disabled(didSave ? false : !canSubmit)
        }
    }

    private var canSubmit: Bool {
        !currentPassword.isEmpty
            && newPassword.count >= 12
            && newPassword != currentPassword
            && newPassword == confirmation
            && !isSaving
    }

    private func submit() async {
        if didSave {
            dismiss()
            return
        }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let _: MessageResponse = try await client.send(
                "auth/change-password",
                method: .post,
                body: ChangePasswordRequest(
                    currentPassword: currentPassword,
                    newPassword: newPassword
                )
            )
            didSave = true
            currentPassword = ""
            showsCurrentPassword = false
            showsNewPassword = false
            showsConfirmation = false
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }
}
