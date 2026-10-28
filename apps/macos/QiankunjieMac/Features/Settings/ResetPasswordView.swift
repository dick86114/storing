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

    static func passwordVisibilitySymbol(isVisible: Bool) -> String {
        isVisible ? "eye" : "eye.slash"
    }

    var body: some View {
        SettingsPage {
            WorkspacePanel(
                title: "密码安全",
                subtitle: "更新后，其他设备上的登录会失效，需要用新密码重新登录。",
                systemImage: "lock.rotation"
            ) {
                SettingsRow(title: "当前密码", controlWidth: 320) {
                    passwordField(
                        placeholder: "输入当前密码",
                        text: $currentPassword,
                        isVisible: $showsCurrentPassword
                    )
                }

                SettingsRowDivider()

                SettingsRow(
                    title: "新密码",
                    subtitle: "至少 12 个字符，且不能与当前密码相同。",
                    controlWidth: 320
                ) {
                    passwordField(
                        placeholder: "至少 12 个字符",
                        text: $newPassword,
                        isVisible: $showsNewPassword
                    )
                }

                SettingsRowDivider()

                SettingsRow(title: "确认新密码", controlWidth: 320) {
                    passwordField(
                        placeholder: "再次输入新密码",
                        text: $confirmation,
                        isVisible: $showsConfirmation
                    )
                }

                SettingsRowDivider()

                feedback

                SettingsActionsRow {
                    Button(didSave ? "返回" : "更新密码") {
                        Task { await submit() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(WorkspacePalette.primary(for: colorScheme))
                    .keyboardShortcut(.defaultAction)
                    .disabled(didSave ? false : !canSubmit)
                }
            }
        }
    }

    private func passwordField(
        placeholder: String,
        text: Binding<String>,
        isVisible: Binding<Bool>
    ) -> some View {
        ZStack(alignment: .trailing) {
            Group {
                if isVisible.wrappedValue {
                    TextField(placeholder, text: text)
                } else {
                    SecureField(placeholder, text: text)
                }
            }
            .textFieldStyle(.plain)
            .qiankunjieFont(.bodyMedium)
            .padding(.leading, 12)
            .padding(.trailing, 40)
            .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
            .background(QiankunjieColors.background(for: colorScheme), in: RoundedRectangle(cornerRadius: QiankunjieRadius.control))
            .overlay {
                RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }

            Button {
                isVisible.wrappedValue.toggle()
            } label: {
                Image(systemName: Self.passwordVisibilitySymbol(isVisible: isVisible.wrappedValue))
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(QiankunjiePlainButtonStyle())
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .help(isVisible.wrappedValue ? "隐藏密码" : "显示密码")
            .padding(.trailing, 6)
        }
    }

    @ViewBuilder
    private var feedback: some View {
        if let errorMessage {
            inlineMessage(errorMessage, systemImage: "exclamationmark.triangle.fill", color: .red)
        } else if didSave {
            inlineMessage("密码已更新，后续登录请使用新密码。", systemImage: "checkmark.circle.fill", color: .green)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                requirement("至少 12 个字符", satisfied: newPassword.count >= 12)
                requirement("新密码不能与当前密码相同", satisfied: !newPassword.isEmpty && newPassword != currentPassword)
                requirement("两次输入的新密码一致", satisfied: !confirmation.isEmpty && newPassword == confirmation)
            }
        }
    }

    private func inlineMessage(_ message: String, systemImage: String, color: Color) -> some View {
        Label(message, systemImage: systemImage)
            .qiankunjieFont(.bodyMedium)
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
        .qiankunjieFont(.labelMedium)
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
                ManagementAPIRoute.changePassword,
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
