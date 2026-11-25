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

    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.id == rhs.id
            && lhs.url == rhs.url
            && lhs.normalizedURL == rhs.normalizedURL
            && lhs.status == rhs.status
            && lhs.stage == rhs.stage
            && lhs.method == rhs.method
            && lhs.captureStrategy == rhs.captureStrategy
            && lhs.articleId == rhs.articleId
            && lhs.title == rhs.title
            && lhs.error == rhs.error
            && lhs.errorSummary == rhs.errorSummary
            && lhs.errorDetails == rhs.errorDetails
            && lhs.errorHint == rhs.errorHint
            && lhs.createdAt == rhs.createdAt
            && lhs.updatedAt == rhs.updatedAt
            && lhs.startedAt == rhs.startedAt
            && lhs.finishedAt == rhs.finishedAt
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(url)
        hasher.combine(normalizedURL)
        hasher.combine(status)
        hasher.combine(stage)
        hasher.combine(method)
        hasher.combine(captureStrategy)
        hasher.combine(articleId)
        hasher.combine(title)
        hasher.combine(error)
        hasher.combine(errorSummary)
        hasher.combine(errorDetails)
        hasher.combine(errorHint)
        hasher.combine(createdAt)
        hasher.combine(updatedAt)
        hasher.combine(startedAt)
        hasher.combine(finishedAt)
    }
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
