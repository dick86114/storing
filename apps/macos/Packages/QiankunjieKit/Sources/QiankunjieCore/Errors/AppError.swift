public enum AppError: Error, Hashable, Sendable {
    case network
    case authenticationRequired
    case forbidden
    case rateLimited
    case contentUnavailable
    case categoryConflict(message: String)
    case invalidInput
    case server
}
