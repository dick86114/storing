import Foundation
import QiankunjieAuth
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct SettingsModelTests {
    @Test func 外观选择持久化并在重新加载时保留() throws {
        let (defaults, suiteName) = try 临时偏好存储()
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let first = SettingsModel(
            authModel: 空认证模型(),
            sessionStore: 内存会话存储(),
            sessionService: 模拟会话服务(),
            appearanceDefaults: defaults
        )

        first.setAppearance(.dark)

        #expect(first.appearance == .dark)
        #expect(defaults.string(forKey: SettingsModel.appearanceStorageKey) == AppearancePreference.dark.rawValue)

        let second = SettingsModel(
            authModel: 空认证模型(),
            sessionStore: 内存会话存储(),
            sessionService: 模拟会话服务(),
            appearanceDefaults: defaults
        )

        #expect(second.appearance == .dark)
    }

    @Test func 会话列表加载服务返回的macOS会话() async throws {
        let authModel = 空认证模型()
        let sessions = [
            设备会话(id: "session-stale", deviceID: "device-1"),
            设备会话(id: "session-other", deviceID: "device-2"),
        ]
        let service = 模拟会话服务(sessions: sessions)
        let model = SettingsModel(
            authModel: authModel,
            sessionStore: 内存会话存储(),
            sessionService: service,
            currentDeviceID: "device-1"
        )
        let loggedIn = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
        )
        #expect(loggedIn)

        await model.loadSessions()

        #expect(model.sessions == sessions)
        #expect(model.currentSessionID == "session-current")
        #expect(model.sessionErrorMessage == nil)
        #expect(await service.loadCount == 1)
    }

    @Test func 加载会话失败显示中文错误() async {
        let authModel = 空认证模型()
        let model = SettingsModel(
            authModel: authModel,
            sessionStore: 内存会话存储(),
            sessionService: 模拟会话服务(loadError: AppError.network)
        )
        let loggedIn = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
        )
        #expect(loggedIn)

        await model.loadSessions()

        #expect(model.sessions.isEmpty)
        #expect(model.sessionErrorMessage == "设备会话加载失败，请稍后重试")
    }

    @Test func 撤销当前会话后清理本地登录状态() async throws {
        let store = 内存会话存储(tokens: SessionTokens(accessToken: "", refreshToken: "refresh-token"))
        let authModel = AuthModel(
            repository: AuthRepository(
                client: 可登录认证客户端(),
                store: store
            )
        )
        let service = 模拟会话服务(sessions: [
            设备会话(id: "session-current", deviceID: "device-1"),
            设备会话(id: "session-other", deviceID: "device-2"),
        ])
        let model = SettingsModel(
            authModel: authModel,
            sessionStore: store,
            sessionService: service,
            currentDeviceID: "device-1"
        )
        var clearedUserState = false
        model.onUserStateCleared = {
            clearedUserState = true
        }
        let loggedIn = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
        )
        #expect(loggedIn)
        await model.loadSessions()

        await model.revokeSession(id: "session-current")

        #expect(await service.revokeIDs == ["session-current"])
        #expect(try await store.read() == nil)
        #expect(model.authState.user == nil)
        #expect(clearedUserState)
        #expect(model.sessions.isEmpty)
    }

    @Test func 退出登录清理令牌用户状态并通知外壳() async throws {
        let store = 内存会话存储(tokens: SessionTokens(accessToken: "", refreshToken: "refresh-token"))
        let authModel = AuthModel(
            repository: AuthRepository(
                client: 可登录认证客户端(),
                store: store
            )
        )
        let model = SettingsModel(
            authModel: authModel,
            sessionStore: store,
            sessionService: 模拟会话服务()
        )
        var clearedUserState = false
        model.onUserStateCleared = {
            clearedUserState = true
        }
        let loggedIn = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
        )
        #expect(loggedIn)

        await model.logout()

        #expect(try await store.read() == nil)
        #expect(model.authState.user == nil)
        #expect(clearedUserState)
    }

    @Test func 设备会话解析服务端毫秒时间() throws {
        let json = Data("""
        {
          "id": "session-current",
          "device_id": "device-1",
          "device_name": "测试 Mac",
          "app_version": "1.0.0",
          "created_at": "2026-01-01T08:00:00.123Z",
          "last_used_at": "2026-01-02T08:00:00.456Z",
          "expires_at": "2026-04-01T08:00:00.789Z"
        }
        """.utf8)

        let session = try JSONDecoder.qiankunjie.decode(DeviceSession.self, from: json)

        #expect(session.id == "session-current")
        #expect(session.createdAt?.timeIntervalSince1970 == 1_767_254_400.123)
        #expect(session.lastUsedAt?.timeIntervalSince1970 == 1_767_340_800.456)
        #expect(session.expiresAt?.timeIntervalSince1970 == 1_775_030_400.789)
    }
}

private extension SettingsModel {
    static func fixture() -> SettingsModel {
        SettingsModel(
            authModel: 空认证模型(),
            sessionStore: 内存会话存储(),
            sessionService: 模拟会话服务()
        )
    }
}

@MainActor
private func 空认证模型() -> AuthModel {
    AuthModel(
        repository: AuthRepository(
            client: 可登录认证客户端(),
            store: 内存会话存储()
        )
    )
}

private func 设备会话(
    id: String,
    deviceID: String
) -> DeviceSession {
    DeviceSession(
        id: id,
        deviceID: deviceID,
        deviceName: "测试 Mac",
        appVersion: "1.0.0",
        createdAt: Date(timeIntervalSince1970: 1_760_000_000),
        lastUsedAt: Date(timeIntervalSince1970: 1_760_000_100),
        expiresAt: Date(timeIntervalSince1970: 1_760_864_000)
    )
}

private func 临时偏好存储() throws -> (defaults: UserDefaults, suiteName: String) {
    let suiteName = "com.idickies.storing.macos.tests.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        throw NSError(
            domain: "SettingsModelTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "无法创建临时偏好存储"]
        )
    }
    return (defaults, suiteName)
}

private struct 可登录认证客户端: AuthClient {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        AuthSessionResponse(
            accessToken: "access-token",
            refreshToken: "rotated-refresh-token",
            user: AuthenticatedUser(id: 9, username: "admin", role: "admin", status: "active"),
            session: AuthSession(id: "session-current", expiresAt: nil)
        )
    }

    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.authenticationRequired
    }
}

private actor 内存会话存储: SessionStore {
    private var tokens: SessionTokens?

    init(tokens: SessionTokens? = nil) {
        self.tokens = tokens
    }

    func read() async throws -> SessionTokens? {
        tokens
    }

    func save(_ tokens: SessionTokens) async throws {
        self.tokens = tokens
    }

    func clear() async throws {
        tokens = nil
    }
}

private actor 模拟会话服务: DeviceSessionServicing {
    private let sessions: [DeviceSession]
    private let loadError: AppError?
    private(set) var loadCount = 0
    private(set) var revokeIDs: [String] = []

    init(
        sessions: [DeviceSession] = [],
        loadError: AppError? = nil
    ) {
        self.sessions = sessions
        self.loadError = loadError
    }

    func sessions() async throws -> [DeviceSession] {
        loadCount += 1
        if let loadError {
            throw loadError
        }
        return sessions
    }

    func revoke(id: String) async throws {
        revokeIDs.append(id)
    }
}
