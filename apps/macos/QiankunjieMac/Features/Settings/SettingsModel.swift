import Foundation
import AppKit
import CoreGraphics
import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieNetworking
import SwiftUI

public enum AppFontPreference: String, CaseIterable, Codable, Identifiable, Sendable {
    case small
    case standard
    case large
    case extraLarge

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .small: "小"
        case .standard: "标准"
        case .large: "大"
        case .extraLarge: "特大"
        }
    }

    public var dynamicTypeSize: DynamicTypeSize {
        switch self {
        case .small: .small
        case .standard: .medium
        case .large: .large
        case .extraLarge: .xLarge
        }
    }

    public var uiScale: CGFloat {
        switch self {
        case .small: 0.8
        case .standard: 0.9
        case .large: 1
        case .extraLarge: 1.18
        }
    }

    public var pointSize: CGFloat {
        switch self {
        case .small: 14
        case .standard: 15
        case .large: 17
        case .extraLarge: 20
        }
    }
}

public enum ReaderContentWidthPreference: String, CaseIterable, Codable, Identifiable, Sendable {
    case normal
    case wide

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .normal: "正常"
        case .wide: "宽"
        }
    }

    public var cssWidth: String {
        self == .wide ? "95%" : "720px"
    }
}

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
        let response: DeviceSessionListResponse
        do {
            response = try await apiClient.send(
                .get("macos/auth/sessions"),
                authenticated: true
            )
        } catch AppError.contentUnavailable {
            response = try await apiClient.send(
                .get("mobile/auth/sessions"),
                authenticated: true
            )
        }
        return response.sessions
    }

    func revoke(id: String) async throws {
        let path = try Self.encodedPath(for: id)

        do {
            let _: RevokedSessionResponse = try await apiClient.send(
                .delete(path),
                authenticated: true
            )
        } catch AppError.contentUnavailable {
            let legacyPath = path.replacingOccurrences(of: "macos/auth/sessions", with: "mobile/auth/sessions")
            let _: RevokedSessionResponse = try await apiClient.send(
                .delete(legacyPath),
                authenticated: true
            )
        }
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
    static let appFontStorageKey = "reader.font.preference"
    static let readerContentWidthStorageKey = "reader.contentWidth.preference"

    let authState: AuthModel
    let serviceAddress = APIClient.defaultBaseURL.absoluteString
    let environmentName = "生产环境"

    var onUserStateCleared: (@MainActor () async -> Void)?
    private(set) var appearance: AppearancePreference
    private(set) var systemColorScheme: ColorScheme
    private(set) var appFont = AppFontPreference.standard
    private(set) var readerContentWidth = ReaderContentWidthPreference.normal
    private(set) var sessions: [DeviceSession] = []
    private(set) var currentSessionID: String?
    private(set) var isLoadingSessions = false
    private(set) var isLoggingOut = false
    private(set) var mutatingSessionIDs: Set<String> = []
    private(set) var sessionErrorMessage: String?

    private let sessionService: any DeviceSessionServicing
    private let appearanceDefaults: UserDefaults
    private var systemAppearanceObservation: NSKeyValueObservation?
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

        systemColorScheme = Self.colorScheme(for: NSApplication.shared.effectiveAppearance)

        if
            let storedValue = appearanceDefaults.string(forKey: Self.appFontStorageKey),
            let preference = AppFontPreference(rawValue: storedValue)
        {
            appFont = preference
        }

        if
            let storedValue = appearanceDefaults.string(forKey: Self.readerContentWidthStorageKey),
            let preference = ReaderContentWidthPreference(rawValue: storedValue)
        {
            readerContentWidth = preference
        }

        // 启动就应用一次外观，保证从菜单栏等不经过主窗口的入口进入时也是正确外观。
        AppearanceApplier.apply(appearance)
        installSystemAppearanceObserverIfNeeded()
    }

    var resolvedColorScheme: ColorScheme {
        appearance.resolvedColorScheme(system: systemColorScheme)
    }

    func setAppearance(_ preference: AppearancePreference) {
        guard preference != appearance else { return }

        appearance = preference
        appearanceDefaults.set(preference.rawValue, forKey: Self.appearanceStorageKey)
        AppearanceApplier.apply(preference)
    }

    func setAppFont(_ preference: AppFontPreference) {
        guard preference != appFont else { return }

        appFont = preference
        appearanceDefaults.set(preference.rawValue, forKey: Self.appFontStorageKey)
    }

    func setReaderContentWidth(_ preference: ReaderContentWidthPreference) {
        guard preference != readerContentWidth else { return }

        readerContentWidth = preference
        appearanceDefaults.set(preference.rawValue, forKey: Self.readerContentWidthStorageKey)
    }

    private func installSystemAppearanceObserverIfNeeded() {
        guard systemAppearanceObservation == nil else { return }
        systemAppearanceObservation = NSApplication.shared.observe(
            \.effectiveAppearance,
            options: [.new]
        ) { [weak self] _, _ in
            MainActor.assumeIsolated {
                self?.systemColorScheme = Self.colorScheme(for: NSApplication.shared.effectiveAppearance)
            }
        }
    }

    private static func colorScheme(for appearance: NSAppearance) -> ColorScheme {
        appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? .dark : .light
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

        invalidateSessionRequests()
        await authState.logout()
        sessions = []
        currentSessionID = nil
        await onUserStateCleared?()
    }

    private func invalidateSessionRequests() {
        sessionsRequestGeneration += 1
        isLoadingSessions = false
        sessionErrorMessage = nil
    }
}
