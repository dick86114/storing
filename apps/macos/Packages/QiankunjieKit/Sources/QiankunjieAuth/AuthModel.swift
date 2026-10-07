import Observation
import QiankunjieCore

public enum AuthBootState: Equatable, Sendable {
    case loading
    case authenticated
    case offline
    case authenticationRequired
}

@MainActor
@Observable
public final class AuthModel {
    public private(set) var user: AuthenticatedUser?
    public private(set) var isRestoring = false
    public private(set) var isSubmitting = false
    public private(set) var errorMessage: String?
    public private(set) var bootState: AuthBootState = .loading

    public let repository: AuthRepository

    public init(repository: AuthRepository) {
        self.repository = repository
    }

    public var isAuthenticated: Bool {
        user != nil
    }

    public func clearError() {
        errorMessage = nil
    }

    public func restore() async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            let restoredUser = try await repository.restore()
            user = restoredUser
            errorMessage = nil
            bootState = restoredUser == nil ? .authenticationRequired : .authenticated
        } catch {
            user = nil
            errorMessage = Self.message(for: error)
            bootState = error is AppError && (error as? AppError) == .network ? .offline : .authenticationRequired
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
            bootState = .authenticated
            return true
        } catch {
            user = nil
            bootState = .authenticationRequired
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
        bootState = .authenticationRequired
    }

    private static func message(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "操作失败，请稍后重试"
        }

        switch appError {
        case .network:
            return "无法连接服务器，请检查网络后重试"
        case .authenticationRequired:
            return "登录状态已过期，请重新登录"
        case .forbidden:
            return "当前账号暂时无法执行此操作"
        case .rateLimited:
            return "登录尝试过于频繁，请稍后再试"
        case .contentUnavailable:
            return "请求的内容暂时不可用"
        case .invalidInput:
            return "输入内容无效，请检查后重试"
        case .server:
            return "服务暂时不可用，请稍后重试"
        }
    }

    private static func loginMessage(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "登录暂时没有成功，请稍后重试"
        }
        if appError == .authenticationRequired {
            return "用户名或密码不正确，请检查后重试"
        }
        return message(for: appError)
    }
}
