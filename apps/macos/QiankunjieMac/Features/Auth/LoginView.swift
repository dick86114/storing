import QiankunjieAuth
import QiankunjieDesignSystem
import SwiftUI

@MainActor
struct LoginView: View {
    let authModel: AuthModel
    let onAuthenticated: @MainActor () -> Void
    var onCancel: (() -> Void)?
    private let deviceProvider: MacAuthDeviceProvider

    @Environment(\.colorScheme) private var colorScheme
    @State private var username = ""
    @State private var password = ""

    init(
        authModel: AuthModel,
        onAuthenticated: @escaping @MainActor () -> Void,
        onCancel: (() -> Void)? = nil,
        deviceProvider: MacAuthDeviceProvider = MacAuthDeviceProvider()
    ) {
        self.authModel = authModel
        self.onAuthenticated = onAuthenticated
        self.onCancel = onCancel
        self.deviceProvider = deviceProvider
    }

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty
            && !authModel.isSubmitting
    }

    var body: some View {
        loginForm
            .padding(28)
            .frame(width: 420, alignment: .top)
            .background {
                RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                    .fill(QiankunjieColors.surface(for: colorScheme))
                    .shadow(color: .black.opacity(0.24), radius: 28, y: 12)
            }
            .overlay(alignment: .topTrailing) {
                if let onCancel {
                    Button {
                        onCancel()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .padding(12)
                    .accessibilityLabel("关闭登录")
                }
            }
        .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
    }

    private var loginForm: some View {
        VStack(alignment: .leading, spacing: 24) {
            brandHeader
            usernameField
            passwordField
            errorMessage
            submitButton
        }
    }

    private var brandHeader: some View {
        VStack(spacing: 16) {
            BrandAssetName.brandLogo.image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 64, height: 64)
                .accessibilityLabel(BrandAssetName.brandLogo.accessibilityLabel)

            Text("登录乾坤戒")
                .font(.title2.weight(.semibold))
        }
    }

    private var usernameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("用户名")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            TextField("用户名", text: $username)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .textContentType(.username)
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("密码")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            SecureField("密码", text: $password)
                .textFieldStyle(.roundedBorder)
                .onSubmit(submit)
        }
    }

    private var errorMessage: some View {
        Group {
            if let errorMessage = authModel.errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(
                        colorScheme == .dark
                            ? QiankunjieColors.darkError
                            : QiankunjieColors.lightError
                    )
            }
        }
    }

    private var submitButton: some View {
        Button(action: submit) {
            HStack(spacing: 8) {
                if authModel.isSubmitting {
                    ProgressView()
                        .controlSize(.small)
                }
                Text(authModel.isSubmitting ? "正在登录" : "登录")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!canSubmit)
        .keyboardShortcut(.defaultAction)
    }

    private func submit() {
        guard canSubmit else { return }

        Task {
            let succeeded = await authModel.login(
                username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                device: deviceProvider.currentDevice
            )
            if succeeded {
                onAuthenticated()
            }
        }
    }
}
