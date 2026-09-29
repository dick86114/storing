import Foundation
import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieNetworking

struct DeviceSession: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let deviceID: String
    let deviceName: String
    let appVersion: String
    let createdAt: Date?
    let lastUsedAt: Date?
    let expiresAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case deviceID = "deviceId"
        case deviceName
        case appVersion
        case createdAt
        case lastUsedAt
        case expiresAt
    }

    init(
        id: String,
        deviceID: String,
        deviceName: String,
        appVersion: String,
        createdAt: Date?,
        lastUsedAt: Date?,
        expiresAt: Date?
    ) {
        self.id = id
        self.deviceID = deviceID
        self.deviceName = deviceName
        self.appVersion = appVersion
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
        self.expiresAt = expiresAt
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        deviceID = try container.decode(String.self, forKey: .deviceID)
        deviceName = try container.decode(String.self, forKey: .deviceName)
        appVersion = try container.decode(String.self, forKey: .appVersion)
        createdAt = try Self.date(forKey: .createdAt, in: container)
        lastUsedAt = try Self.date(forKey: .lastUsedAt, in: container)
        expiresAt = try Self.date(forKey: .expiresAt, in: container)
    }

    private static func date(
        forKey key: CodingKeys,
        in container: KeyedDecodingContainer<CodingKeys>
    ) throws -> Date? {
        guard let value = try container.decodeIfPresent(String.self, forKey: key) else {
            return nil
        }

        // 服务端时间保留毫秒；这里显式解析，避免严格 ISO8601 策略丢掉会话时间。
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}

protocol DeviceSessionServicing: Sendable {
    func sessions() async throws -> [DeviceSession]
    func revoke(id: String) async throws
}

struct AuthRepositoryDeviceSessionService: DeviceSessionServicing {
    private let apiClient: APIClient

    init(repository: AuthRepository) {
        apiClient = APIClient(tokenProvider: repository)
    }

    func sessions() async throws -> [DeviceSession] {
        let response: DeviceSessionListResponse = try await apiClient.send(
            .get("macos/auth/sessions"),
            authenticated: true
        )
        return response.sessions
    }

    func revoke(id: String) async throws {
        let path = try Self.encodedPath(for: id)

        let _: RevokedSessionResponse = try await apiClient.send(
            .delete(path),
            authenticated: true
        )
    }

    static func encodedPath(for id: String) throws -> String {
        let allowedCharacters = CharacterSet(
            charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-"
        )
        guard
            !id.isEmpty,
            id.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }),
            let encodedID = id.addingPercentEncoding(withAllowedCharacters: allowedCharacters),
            encodedID == id
        else {
            throw AppError.invalidInput
        }

        return "macos/auth/sessions/\(encodedID)"
    }
}

private struct DeviceSessionListResponse: Decodable, Sendable {
    let sessions: [DeviceSession]
}

private struct RevokedSessionResponse: Decodable, Sendable {
    let revoked: Bool
}

@MainActor
@Observable
final class SettingsModel {
    static let appearanceStorageKey = "appearance.preference"

    let authState: AuthModel
    let serviceAddress = APIClient.defaultBaseURL.absoluteString
    let environmentName = "生产环境"

    var onUserStateCleared: (@MainActor () async -> Void)?
    private(set) var appearance: AppearancePreference
    private(set) var sessions: [DeviceSession] = []
    private(set) var currentSessionID: String?
    private(set) var isLoadingSessions = false
    private(set) var isLoggingOut = false
    private(set) var mutatingSessionIDs: Set<String> = []
    private(set) var sessionErrorMessage: String?

    private let sessionService: any DeviceSessionServicing
    private let appearanceDefaults: UserDefaults
    private var sessionsRequestGeneration = 0

    init(
        authModel: AuthModel,
        sessionService: (any DeviceSessionServicing)? = nil,
        appearanceDefaults: UserDefaults = .standard
    ) {
        self.authState = authModel
        self.sessionService = sessionService ?? AuthRepositoryDeviceSessionService(
            repository: authModel.repository
        )
        self.appearanceDefaults = appearanceDefaults

        if
            let storedValue = appearanceDefaults.string(forKey: Self.appearanceStorageKey),
            let preference = AppearancePreference(rawValue: storedValue)
        {
            appearance = preference
        } else {
            if appearanceDefaults.object(forKey: Self.appearanceStorageKey) != nil {
                appearanceDefaults.removeObject(forKey: Self.appearanceStorageKey)
            }
            appearance = .system
        }
    }

    func setAppearance(_ preference: AppearancePreference) {
        guard preference != appearance else { return }

        appearance = preference
        appearanceDefaults.set(preference.rawValue, forKey: Self.appearanceStorageKey)
    }

    func loadSessions() async {
        guard authState.isAuthenticated else {
            sessions = []
            currentSessionID = nil
            return
        }

        sessionsRequestGeneration += 1
        let generation = sessionsRequestGeneration
        isLoadingSessions = true
        sessionErrorMessage = nil

        do {
            let loadedSessions = try await sessionService.sessions()
            guard generation == sessionsRequestGeneration else { return }

            var repositorySessionID = await authState.repository.currentSessionID
            guard generation == sessionsRequestGeneration else { return }

            if repositorySessionID == nil {
                try await authState.repository.refreshTokens()
                guard generation == sessionsRequestGeneration else { return }

                repositorySessionID = await authState.repository.currentSessionID
                guard generation == sessionsRequestGeneration else { return }
            }

            sessions = loadedSessions
            currentSessionID = repositorySessionID
        } catch {
            guard generation == sessionsRequestGeneration else { return }

            sessions = []
            currentSessionID = nil
            sessionErrorMessage = "设备会话加载失败，请稍后重试"
        }

        if generation == sessionsRequestGeneration {
            isLoadingSessions = false
        }
    }

    func revokeSession(id: String) async {
        guard !mutatingSessionIDs.contains(id) else { return }

        mutatingSessionIDs.insert(id)
        defer {
            mutatingSessionIDs.remove(id)
        }

        do {
            let isCurrentSession = id == currentSessionID
            try await sessionService.revoke(id: id)
            sessionErrorMessage = nil

            if isCurrentSession {
                await logout()
            } else {
                sessions.removeAll { $0.id == id }
            }
        } catch {
            sessionErrorMessage = "设备会话撤销失败，请稍后重试"
        }
    }

    func logout() async {
        guard !isLoggingOut else { return }

        isLoggingOut = true
        defer {
            isLoggingOut = false
        }

        sessionsRequestGeneration += 1
        await authState.logout()
        sessions = []
        currentSessionID = nil
        await onUserStateCleared?()
    }
}
