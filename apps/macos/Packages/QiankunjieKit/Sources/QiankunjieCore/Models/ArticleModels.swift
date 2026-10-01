import Foundation

public struct ArticleCategory: Codable, Hashable, Sendable {
    public let id: Int
    public let name: String
    public let articleDescription: String?
    public let includeExamples: [String]
    public let excludeExamples: [String]
    public let color: String?
    public let sortOrder: Int
    public let isActive: Bool
    public let isSystem: Bool

    public init(
        id: Int,
        name: String,
        articleDescription: String? = nil,
        includeExamples: [String] = [],
        excludeExamples: [String] = [],
        color: String? = nil,
        sortOrder: Int = 0,
        isActive: Bool = true,
        isSystem: Bool = false
    ) {
        self.id = id
        self.name = name
        self.articleDescription = articleDescription
        self.includeExamples = includeExamples
        self.excludeExamples = excludeExamples
        self.color = color
        self.sortOrder = sortOrder
        self.isActive = isActive
        self.isSystem = isSystem
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(Int.self, forKey: .id),
            name: try container.decode(String.self, forKey: .name),
            articleDescription: try container.decodeIfPresent(String.self, forKey: .articleDescription),
            includeExamples: try container.decodeIfPresent([String].self, forKey: .includeExamples) ?? [],
            excludeExamples: try container.decodeIfPresent([String].self, forKey: .excludeExamples) ?? [],
            color: try container.decodeIfPresent(String.self, forKey: .color),
            sortOrder: try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0,
            isActive: try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true,
            isSystem: try container.decodeIfPresent(Bool.self, forKey: .isSystem) ?? false
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case articleDescription = "description"
        case includeExamples = "includeExamples"
        case excludeExamples = "excludeExamples"
        case color
        case sortOrder = "sortOrder"
        case isActive = "isActive"
        case isSystem = "isSystem"
    }
}

public struct ArticleCategoryResult: Codable, Hashable, Sendable {
    public let categoryId: Int
    public let confidence: Double?
    public let reason: String?
    public let source: String
    public let reviewStatus: String
    public let modelVersion: String?

    enum CodingKeys: String, CodingKey {
        case categoryId = "categoryId"
        case confidence
        case reason
        case source
        case reviewStatus = "reviewStatus"
        case modelVersion = "modelVersion"
    }
}

public struct ArticleCard: Codable, Hashable, Sendable {
    public let id: Int
    public let title: String?
    public let author: String?
    public let source: String?
    public let originalURL: String?
    public let publicID: String?
    public let coverImage: String?
    public let publishTime: Date?
    public let createdAt: Date?
    public let aiSummary: String?
    public let aiCategory: String?
    public let aiTags: [String]
    public let category: ArticleCategory?
    public let categoryResult: ArticleCategoryResult?
    public let isFavorited: Bool
    public let isArchived: Bool
    public let isPublished: Bool

    public init(
        id: Int,
        title: String? = nil,
        author: String? = nil,
        source: String? = nil,
        originalURL: String? = nil,
        publicID: String? = nil,
        coverImage: String? = nil,
        publishTime: Date? = nil,
        createdAt: Date? = nil,
        aiSummary: String? = nil,
        aiCategory: String? = nil,
        aiTags: [String] = [],
        category: ArticleCategory? = nil,
        categoryResult: ArticleCategoryResult? = nil,
        isFavorited: Bool = false,
        isArchived: Bool = false,
        isPublished: Bool = false
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.source = source
        self.originalURL = originalURL
        self.publicID = publicID
        self.coverImage = coverImage
        self.publishTime = publishTime
        self.createdAt = createdAt
        self.aiSummary = aiSummary
        self.aiCategory = aiCategory
        self.aiTags = aiTags
        self.category = category
        self.categoryResult = categoryResult
        self.isFavorited = isFavorited
        self.isArchived = isArchived
        self.isPublished = isPublished
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(Int.self, forKey: .id),
            title: try container.decodeIfPresent(String.self, forKey: .title),
            author: try container.decodeIfPresent(String.self, forKey: .author),
            source: try container.decodeIfPresent(String.self, forKey: .source),
            originalURL: try container.decodeIfPresent(String.self, forKey: .originalURL),
            publicID: try container.decodeIfPresent(String.self, forKey: .publicID),
            coverImage: try container.decodeIfPresent(String.self, forKey: .coverImage),
            publishTime: try container.decodeIfPresent(Date.self, forKey: .publishTime),
            createdAt: try container.decodeIfPresent(Date.self, forKey: .createdAt),
            aiSummary: try container.decodeIfPresent(String.self, forKey: .aiSummary),
            aiCategory: try container.decodeIfPresent(String.self, forKey: .aiCategory),
            aiTags: try container.decodeIfPresent([String].self, forKey: .aiTags) ?? [],
            category: try container.decodeIfPresent(ArticleCategory.self, forKey: .category),
            categoryResult: try container.decodeIfPresent(ArticleCategoryResult.self, forKey: .categoryResult),
            isFavorited: try container.decodeIfPresent(Bool.self, forKey: .isFavorited) ?? false,
            isArchived: try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false,
            isPublished: try container.decodeIfPresent(Bool.self, forKey: .isPublished) ?? false
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case author
        case source
        case originalURL = "originalUrl"
        case publicID = "publicId"
        case coverImage = "coverImage"
        case publishTime = "publishTime"
        case createdAt = "createdAt"
        case aiSummary = "aiSummary"
        case aiCategory = "aiCategory"
        case aiTags = "aiTags"
        case category
        case categoryResult = "categoryResult"
        case isFavorited = "isFavorited"
        case isArchived = "isArchived"
        case isPublished = "isPublished"
    }
}

public struct ArticleListPage: Codable, Hashable, Sendable {
    public let articles: [ArticleCard]
    public let total: Int
    public let page: Int
    public let perPage: Int
    public let totalPages: Int

    public init(
        articles: [ArticleCard],
        total: Int,
        page: Int,
        perPage: Int,
        totalPages: Int
    ) {
        self.articles = articles
        self.total = total
        self.page = page
        self.perPage = perPage
        self.totalPages = totalPages
    }

    enum CodingKeys: String, CodingKey {
        case articles
        case total
        case page
        case perPage = "perPage"
        case totalPages = "totalPages"
    }
}

public struct ArticleDetail: Codable, Hashable, Sendable {
    public let id: Int
    public let title: String?
    public let author: String?
    public let source: String?
    public let originalURL: String?
    public let publicID: String?
    public let coverImage: String?
    public let publishTime: Date?
    public let createdAt: Date?
    public let aiSummary: String?
    public let aiCategory: String?
    public let aiTags: [String]
    public let category: ArticleCategory?
    public let categoryResult: ArticleCategoryResult?
    public let isFavorited: Bool
    public let isArchived: Bool
    public let isPublished: Bool
    public let contentHTML: String?
    public let contentMarkdown: String?

    public init(
        id: Int,
        title: String? = nil,
        author: String? = nil,
        source: String? = nil,
        originalURL: String? = nil,
        publicID: String? = nil,
        coverImage: String? = nil,
        publishTime: Date? = nil,
        createdAt: Date? = nil,
        aiSummary: String? = nil,
        aiCategory: String? = nil,
        aiTags: [String] = [],
        category: ArticleCategory? = nil,
        categoryResult: ArticleCategoryResult? = nil,
        isFavorited: Bool = false,
        isArchived: Bool = false,
        isPublished: Bool = false,
        contentHTML: String? = nil,
        contentMarkdown: String? = nil
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.source = source
        self.originalURL = originalURL
        self.publicID = publicID
        self.coverImage = coverImage
        self.publishTime = publishTime
        self.createdAt = createdAt
        self.aiSummary = aiSummary
        self.aiCategory = aiCategory
        self.aiTags = aiTags
        self.category = category
        self.categoryResult = categoryResult
        self.isFavorited = isFavorited
        self.isArchived = isArchived
        self.isPublished = isPublished
        self.contentHTML = contentHTML
        self.contentMarkdown = contentMarkdown
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(Int.self, forKey: .id),
            title: try container.decodeIfPresent(String.self, forKey: .title),
            author: try container.decodeIfPresent(String.self, forKey: .author),
            source: try container.decodeIfPresent(String.self, forKey: .source),
            originalURL: try container.decodeIfPresent(String.self, forKey: .originalURL),
            publicID: try container.decodeIfPresent(String.self, forKey: .publicID),
            coverImage: try container.decodeIfPresent(String.self, forKey: .coverImage),
            publishTime: try container.decodeIfPresent(Date.self, forKey: .publishTime),
            createdAt: try container.decodeIfPresent(Date.self, forKey: .createdAt),
            aiSummary: try container.decodeIfPresent(String.self, forKey: .aiSummary),
            aiCategory: try container.decodeIfPresent(String.self, forKey: .aiCategory),
            aiTags: try container.decodeIfPresent([String].self, forKey: .aiTags) ?? [],
            category: try container.decodeIfPresent(ArticleCategory.self, forKey: .category),
            categoryResult: try container.decodeIfPresent(ArticleCategoryResult.self, forKey: .categoryResult),
            isFavorited: try container.decodeIfPresent(Bool.self, forKey: .isFavorited) ?? false,
            isArchived: try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false,
            isPublished: try container.decodeIfPresent(Bool.self, forKey: .isPublished) ?? false,
            contentHTML: try container.decodeIfPresent(String.self, forKey: .contentHTML),
            contentMarkdown: try container.decodeIfPresent(String.self, forKey: .contentMarkdown)
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case author
        case source
        case originalURL = "originalUrl"
        case publicID = "publicId"
        case coverImage = "coverImage"
        case publishTime = "publishTime"
        case createdAt = "createdAt"
        case aiSummary = "aiSummary"
        case aiCategory = "aiCategory"
        case aiTags = "aiTags"
        case category
        case categoryResult = "categoryResult"
        case isFavorited = "isFavorited"
        case isArchived = "isArchived"
        case isPublished = "isPublished"
        case contentHTML = "contentHtml"
        case contentMarkdown = "contentMd"
    }
}

public struct ArticleCounts: Codable, Hashable, Sendable {
    public let inbox: Int
    public let favorites: Int
    public let archive: Int
    public let published: Int

    public init(
        inbox: Int,
        favorites: Int,
        archive: Int,
        published: Int
    ) {
        self.inbox = inbox
        self.favorites = favorites
        self.archive = archive
        self.published = published
    }
}

public extension JSONDecoder {
    static var qiankunjie: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let rawValue = try container.decode(String.self)

            let fractionalFormatter = ISO8601DateFormatter()
            fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractionalFormatter.date(from: rawValue) {
                return date
            }

            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: rawValue) {
                return date
            }

            let sqlFormatter = DateFormatter()
            sqlFormatter.locale = Locale(identifier: "en_US_POSIX")
            sqlFormatter.timeZone = TimeZone(identifier: "Asia/Shanghai")
            sqlFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
            if let date = sqlFormatter.date(from: rawValue) {
                return date
            }

            sqlFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            if let date = sqlFormatter.date(from: rawValue) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "日期格式无效：\(rawValue)"
            )
        }
        return decoder
    }
}
