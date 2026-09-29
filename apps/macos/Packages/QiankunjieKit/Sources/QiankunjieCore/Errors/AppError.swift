public enum AppError: Error, Hashable, Sendable {
    case network
    case authenticationRequired
    case forbidden
    case contentUnavailable
    case invalidInput
    case server
}
