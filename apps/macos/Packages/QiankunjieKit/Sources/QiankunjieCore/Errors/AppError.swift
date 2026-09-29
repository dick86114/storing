public enum AppError: Error, Hashable, Sendable {
    case network(underlying: String? = nil)
    case authenticationRequired
    case forbidden(message: String? = nil)
    case contentUnavailable(message: String? = nil)
    case invalidInput(message: String? = nil)
    case server(statusCode: Int, message: String? = nil)
}
