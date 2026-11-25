import Foundation

public struct CollectJob: Codable, Hashable, Sendable {
    public let id: Int
    public let url: String
    public let normalizedURL: String
    public let status: String
    public let stage: String
    public let method: String?
    public let captureStrategy: String?
    public let articleId: Int?
    public let title: String?
    public let error: String?
    public let errorSummary: String?
    private let storedErrorDetails: [String]?
    public var errorDetails: [String] { storedErrorDetails ?? [] }
    public let errorHint: String?
    public let createdAt: Date?
    public let updatedAt: Date?
    public let startedAt: Date?
    public let finishedAt: Date?

    public var isTerminal: Bool {
        status == "completed" || status == "failed"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case normalizedURL = "normalizedUrl"
        case status
        case stage
        case method
        case captureStrategy = "captureStrategy"
        case articleId = "articleId"
        case title
        case error
        case errorSummary = "errorSummary"
        case storedErrorDetails = "errorDetails"
        case errorHint = "errorHint"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        case startedAt = "startedAt"
        case finishedAt = "finishedAt"
    }
}
