import Foundation

public protocol LegacySessionReading: Sendable {
    func read() async throws -> SessionTokens?
}

public protocol LegacySessionStore: LegacySessionReading {
    func clearLegacy() async throws
}

public actor MigratingSessionStore: SessionStore, LegacySessionStore {
    private let primary: any SessionStore
    private let legacy: any LegacySessionStore
    private var legacyOrigin = false

    public init(primary: any SessionStore, legacy: any LegacySessionStore) {
        self.primary = primary
        self.legacy = legacy
    }

    public func read() async throws -> SessionTokens? {
        try await migrateIfNeeded()
    }

    public func save(_ tokens: SessionTokens) async throws {
        try await primary.save(tokens)
    }

    public func clear() async throws {
        try await primary.clear()
    }

    public func clearLegacy() async throws {
        try await legacy.clearLegacy()
        legacyOrigin = false
    }

    public func migrateIfNeeded() async throws -> SessionTokens? {
        if let tokens = try await primary.read(), !tokens.refreshToken.isEmpty {
            return tokens
        }
        guard let tokens = try await legacy.read(), !tokens.refreshToken.isEmpty else {
            return nil
        }
        try await primary.save(tokens)
        legacyOrigin = true
        return tokens
    }

    public func hasLegacyOrigin() async -> Bool {
        legacyOrigin
    }

    public func takeLegacyOrigin() async -> Bool {
        let value = legacyOrigin
        legacyOrigin = false
        return value
    }
}
