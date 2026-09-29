public protocol TokenRefreshing: Sendable {
    func currentAccessToken() async -> String?
    func refreshAccessToken() async throws -> String
}
