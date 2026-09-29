import Foundation
import QiankunjieCore
import QiankunjieNetworking

public protocol AuthClient: Sendable {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse
    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse
    func logout(refreshToken: String) async throws
    func session(accessToken: String) async throws -> AuthenticatedUser
}

public extension AuthClient {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func logout(refreshToken: String) async throws {
        throw AppError.network
    }

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.network
    }
}

public struct DefaultAuthClient: AuthClient {
    private let apiClient: APIClient

    public init(apiClient: APIClient = APIClient()) {
        self.apiClient = apiClient
    }

    public func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        let body = try JSONEncoder().encode(
            LoginRequest(username: username, password: password, device: device)
        )
        return try await apiClient.send(
            .post("macos/auth/login", body: body),
            authenticated: false
        )
    }

    public func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        let body = try JSONEncoder().encode(
            RefreshRequest(refreshToken: refreshToken, device: device)
        )
        return try await apiClient.send(
            .post("macos/auth/refresh", body: body),
            authenticated: false
        )
    }

    public func logout(refreshToken: String) async throws {
        let body = try JSONEncoder().encode(LogoutRequest(refreshToken: refreshToken))
        let _: RevokedResponse = try await apiClient.send(
            .post("macos/auth/logout", body: body),
            authenticated: false
        )
    }

    public func session(accessToken: String) async throws -> AuthenticatedUser {
        let response: SessionEnvelope = try await apiClient.send(
            .get(
                "macos/auth/session",
                headers: ["Authorization": "Bearer \(accessToken)"]
            ),
            authenticated: false
        )
        return response.user
    }
}

public actor AuthRepository: TokenRefreshing {
    public private(set) var currentUser: AuthenticatedUser?

    private let client: any AuthClient
    private let store: any SessionStore
    private let device: AuthDevice?
    private var tokens: SessionTokens?
    private var refreshTask: Task<Void, Error>?
    private var refreshTaskID: UUID?
    private var sessionGeneration = 0

    public init(
        client: any AuthClient = DefaultAuthClient(),
        store: any SessionStore = KeychainSessionStore(),
        device: AuthDevice? = nil
    ) {
        self.client = client
        self.store = store
        self.device = device
    }

    public func currentAccessToken() async -> String? {
        guard let accessToken = tokens?.accessToken, !accessToken.isEmpty else {
            return nil
        }
        return accessToken
    }

    public func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthenticatedUser {
        await clearSession()
        let response = try await client.login(
            username: username,
            password: password,
            device: device
        )
        let nextTokens = SessionTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
        )
        try await store.save(
            SessionTokens(accessToken: "", refreshToken: response.refreshToken)
        )
        tokens = nextTokens
        currentUser = response.user
        return response.user
    }

    public func restore() async throws -> AuthenticatedUser? {
        guard let storedTokens = try await store.read(), !storedTokens.refreshToken.isEmpty else {
            return nil
        }

        do {
            try await refreshTokens()
        } catch AppError.authenticationRequired {
            return nil
        }

        guard let accessToken = tokens?.accessToken else {
            return nil
        }

        do {
            let user = try await client.session(accessToken: accessToken)
            currentUser = user
            return user
        } catch AppError.authenticationRequired {
            await clearSession()
            return nil
        }
    }

    public func refreshTokens() async throws {
        if let refreshTask {
            try await refreshTask.value
            return
        }

        guard let storedTokens = try await store.read(), !storedTokens.refreshToken.isEmpty else {
            throw AppError.authenticationRequired
        }

        let taskID = UUID()
        let generation = sessionGeneration
        let refreshToken = storedTokens.refreshToken
        let task = Task { [device] in
            try await self.performRefresh(
                refreshToken: refreshToken,
                device: device,
                generation: generation
            )
        }
        refreshTask = task
        refreshTaskID = taskID

        do {
            try await task.value
            clearRefreshTask(taskID)
        } catch {
            clearRefreshTask(taskID)
            if error as? AppError == .authenticationRequired {
                await clearSession()
            }
            throw error
        }
    }

    public func refreshAccessToken() async throws -> String {
        try await refreshTokens()
        guard let accessToken = tokens?.accessToken, !accessToken.isEmpty else {
            throw AppError.authenticationRequired
        }
        return accessToken
    }

    public func logout() async {
        let refreshToken = try? await store.read()
        if let refreshToken, !refreshToken.refreshToken.isEmpty {
            try? await client.logout(refreshToken: refreshToken.refreshToken)
        }
        await clearSession()
    }

    private func performRefresh(
        refreshToken: String,
        device: AuthDevice?,
        generation: Int
    ) async throws {
        let response = try await client.refresh(refreshToken: refreshToken, device: device)
        guard generation == sessionGeneration else {
            throw AppError.authenticationRequired
        }

        let nextTokens = SessionTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
        )
        try await store.save(
            SessionTokens(accessToken: "", refreshToken: response.refreshToken)
        )
        guard generation == sessionGeneration else {
            try? await store.clear()
            throw AppError.authenticationRequired
        }

        tokens = nextTokens
        currentUser = response.user
    }

    private func clearRefreshTask(_ taskID: UUID) {
        guard refreshTaskID == taskID else {
            return
        }
        refreshTask = nil
        refreshTaskID = nil
    }

    private func clearSession() async {
        sessionGeneration += 1
        refreshTask?.cancel()
        refreshTask = nil
        refreshTaskID = nil
        tokens = nil
        currentUser = nil
        try? await store.clear()
    }
}

private struct LoginRequest: Encodable {
    let username: String
    let password: String
    let device: AuthDevice
}

private struct RefreshRequest: Encodable {
    let refreshToken: String
    let device: AuthDevice?

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
        case device
    }
}

private struct LogoutRequest: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private struct SessionEnvelope: Decodable {
    let user: AuthenticatedUser
}

private struct RevokedResponse: Decodable {
    let revoked: Bool
}
