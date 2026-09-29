import Observation
import QiankunjieCore

@MainActor
@Observable
public final class AuthModel {
    public private(set) var user: AuthenticatedUser?
    public private(set) var isRestoring = false
    public private(set) var isSubmitting = false
    public private(set) var errorMessage: String?

    private let repository: AuthRepository

    public init(repository: AuthRepository) {
        self.repository = repository
    }

    public var isAuthenticated: Bool {
        user != nil
    }

    public func restore() async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            user = try await repository.restore()
            errorMessage = nil
        } catch {
            user = nil
            errorMessage = Self.message(for: error)
        }
    }

    @discardableResult
    public func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async -> Bool {
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            user = try await repository.login(
                username: username,
                password: password,
                device: device
            )
            errorMessage = nil
            return true
        } catch {
            user = nil
            errorMessage = Self.loginMessage(for: error)
            return false
        }
    }

    public func logout() async {
        isSubmitting = true
        defer { isSubmitting = false }

        await repository.logout()
        user = nil
        errorMessage = nil
    }

    private static func message(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "操作失败，请稍后重试"
        }

        switch appError {
        case .network:
            return "网络连接失败，请稍后重试"
        case .authenticationRequired:
            return "登录已失效，请重新登录"
        case .forbidden:
            return "当前账号无权执行此操作"
        case .contentUnavailable:
            return "请求的内容不可用"
        case .invalidInput:
            return "输入内容无效"
        case .server:
            return "服务暂时不可用，请稍后重试"
        }
    }

    private static func loginMessage(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "登录失败，请稍后重试"
        }
        if appError == .authenticationRequired {
            return "用户名或密码错误"
        }
        return message(for: appError)
    }
}
