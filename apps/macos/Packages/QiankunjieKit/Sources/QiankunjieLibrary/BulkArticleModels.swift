import Foundation

public enum ArticleBulkAction: String, CaseIterable, Codable, Sendable {
    case favorite
    case unfavorite
    case archive
    case unarchive
    case delete
    case permanentDelete = "permanent_delete"
    case publish
    case unpublish
}

public enum BulkToolbarAction: CaseIterable, Sendable {
    case favorite
    case unfavorite
    case archive
    case unarchive
    case delete
    case permanentDelete
    case publish
    case unpublish
    case setCategory
    case reclassify
    case generateAI
    case exportZIP
    case bulkObsidian
}

public struct ArticleBulkIssue: Codable, Hashable, Sendable {
    public let articleID: Int
    public let code: String
    public let message: String?

    public init(articleID: Int, code: String, message: String? = nil) {
        self.articleID = articleID
        self.code = code
        self.message = message
    }

    enum CodingKeys: String, CodingKey {
        case articleID = "articleId"
        case code
        case message
    }
}

public struct ArticlePublicationLink: Codable, Hashable, Sendable {
    public let articleID: Int
    public let publicURL: String

    public init(articleID: Int, publicURL: String) {
        self.articleID = articleID
        self.publicURL = publicURL
    }

    enum CodingKeys: String, CodingKey {
        case articleID = "articleId"
        case publicURL = "publicUrl"
    }
}

public struct ArticleBulkActionResult: Codable, Hashable, Sendable {
    public let requestedCount: Int
    public let succeededIDs: [Int]
    public let skipped: [ArticleBulkIssue]
    public let failed: [ArticleBulkIssue]
    public let publications: [ArticlePublicationLink]?

    public init(
        requestedCount: Int,
        succeededIDs: [Int],
        skipped: [ArticleBulkIssue],
        failed: [ArticleBulkIssue],
        publications: [ArticlePublicationLink]? = nil
    ) {
        self.requestedCount = requestedCount
        self.succeededIDs = succeededIDs
        self.skipped = skipped
        self.failed = failed
        self.publications = publications
    }

    enum CodingKeys: String, CodingKey {
        case requestedCount = "requestedCount"
        case succeededIDs = "succeededIds"
        case skipped
        case failed
        case publications
    }
}

public struct ArticleBulkAIResult: Codable, Hashable, Sendable {
    public let requestedCount: Int
    public let queuedIDs: [Int]
    public let alreadyQueuedIDs: [Int]
    public let failed: [ArticleBulkIssue]

    public init(
        requestedCount: Int,
        queuedIDs: [Int],
        alreadyQueuedIDs: [Int],
        failed: [ArticleBulkIssue]
    ) {
        self.requestedCount = requestedCount
        self.queuedIDs = queuedIDs
        self.alreadyQueuedIDs = alreadyQueuedIDs
        self.failed = failed
    }

    enum CodingKeys: String, CodingKey {
        case requestedCount = "requestedCount"
        case queuedIDs = "queuedIds"
        case alreadyQueuedIDs = "alreadyQueuedIds"
        case failed
    }
}

public enum ArticleBulkExportStatus: String, Codable, Hashable, Sendable {
    case queued
    case running
    case succeeded
    case failed
}

public struct ArticleBulkExportJob: Codable, Hashable, Sendable {
    public let id: Int
    public let format: String
    public let status: ArticleBulkExportStatus
    public let requestedCount: Int
    public let succeededCount: Int
    public let failedCount: Int
    public let downloadURL: String?
    public let createdAt: Date?
    public let finishedAt: Date?
    public let expiresAt: Date?

    public init(
        id: Int,
        format: String,
        status: ArticleBulkExportStatus,
        requestedCount: Int,
        succeededCount: Int,
        failedCount: Int,
        downloadURL: String?,
        createdAt: Date?,
        finishedAt: Date?,
        expiresAt: Date?
    ) {
        self.id = id
        self.format = format
        self.status = status
        self.requestedCount = requestedCount
        self.succeededCount = succeededCount
        self.failedCount = failedCount
        self.downloadURL = downloadURL
        self.createdAt = createdAt
        self.finishedAt = finishedAt
        self.expiresAt = expiresAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case format
        case status
        case requestedCount = "requestedCount"
        case succeededCount = "succeededCount"
        case failedCount = "failedCount"
        case downloadURL = "downloadUrl"
        case createdAt
        case finishedAt
        case expiresAt
    }
}

public struct NativeBulkResult: Equatable, Sendable {
    public let requestedCount: Int
    public let succeededCount: Int
    public let skippedCount: Int
    public let failedCount: Int
    public let issues: [ArticleBulkIssue]
    public let publications: [ArticlePublicationLink]

    public init(
        requestedCount: Int,
        succeededCount: Int,
        skippedCount: Int,
        failedCount: Int,
        issues: [ArticleBulkIssue],
        publications: [ArticlePublicationLink] = []
    ) {
        self.requestedCount = requestedCount
        self.succeededCount = succeededCount
        self.skippedCount = skippedCount
        self.failedCount = failedCount
        self.issues = issues
        self.publications = publications
    }

    public init(from result: ArticleBulkActionResult) {
        requestedCount = result.requestedCount
        succeededCount = result.succeededIDs.count
        skippedCount = result.skipped.count
        failedCount = result.failed.count
        issues = result.skipped + result.failed
        publications = result.publications ?? []
    }

    public init(from result: ArticleBulkAIResult) {
        requestedCount = result.requestedCount
        succeededCount = result.queuedIDs.count
        skippedCount = result.alreadyQueuedIDs.count
        failedCount = result.failed.count
        issues = result.failed
        publications = []
    }
}

struct BulkActionRequest: Encodable, Sendable {
    let action: ArticleBulkAction
    let articleIDs: [Int]
    let categoryID: Int?

    enum CodingKeys: String, CodingKey {
        case action
        case articleIDs = "articleIds"
        case categoryID = "categoryId"
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(action, forKey: .action)
        try container.encode(articleIDs, forKey: .articleIDs)
        // AI 判断时省略字段，避免把 null 误解释为显式配置。
        try container.encodeIfPresent(categoryID, forKey: .categoryID)
    }
}

struct BulkCategoryRequest: Encodable, Sendable {
    let articleIDs: [Int]
    let categoryID: Int

    enum CodingKeys: String, CodingKey {
        case articleIDs = "articleIds"
        case categoryID = "categoryId"
    }
}

struct BulkAIRequest: Encodable, Sendable {
    let articleIDs: [Int]
    let includeCategory: Bool
    let resetUserCategory: Bool

    enum CodingKeys: String, CodingKey {
        case articleIDs = "articleIds"
        case includeCategory = "includeCategory"
        case resetUserCategory
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(articleIDs, forKey: .articleIDs)
        try container.encode(includeCategory, forKey: .includeCategory)
        if resetUserCategory {
            try container.encode(true, forKey: .resetUserCategory)
        }
    }
}

struct BulkExportRequest: Encodable, Sendable {
    let articleIDs: [Int]
    let format = "zip"
    let includeCategory = true
    let organizeByCategory = true

    enum CodingKeys: String, CodingKey {
        case articleIDs = "articleIds"
        case format
        case includeCategory = "includeAi"
        case organizeByCategory = "organizeByCategory"
    }
}
