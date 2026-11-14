import Foundation

public struct DeepAnalysisSummary: Codable, Hashable, Sendable {
    public var hasDeepAnalysis: Bool
    public var status: String
    public var version: Int?
    public var generatedAt: Date?
    public var stale: Bool
    public var errorCode: String?

    public init(
        hasDeepAnalysis: Bool = false,
        status: String = "not_generated",
        version: Int? = nil,
        generatedAt: Date? = nil,
        stale: Bool = false,
        errorCode: String? = nil
    ) {
        self.hasDeepAnalysis = hasDeepAnalysis
        self.status = status
        self.version = version
        self.generatedAt = generatedAt
        self.stale = stale
        self.errorCode = errorCode
    }
}

public struct DeepAnalysisReport: Codable, Hashable, Sendable {
    public struct Argument: Codable, Hashable, Sendable {
        public var claim: String
        public var evidence: String
        public var quoteAnchor: String?
    }

    public struct Fact: Codable, Hashable, Sendable {
        public var fact: String
        public var basis: String
        public var quoteAnchor: String?
    }

    public struct Viewpoint: Codable, Hashable, Sendable {
        public var stance: String
        public var summary: String
        public var reasoning: String
    }

    public struct Action: Codable, Hashable, Sendable {
        public var action: String
        public var condition: String
    }

    public var executiveSummary: String
    public var coreArguments: [Argument]
    public var reasoningChain: [String]
    public var keyFacts: [Fact]
    public var viewpoints: [Viewpoint]
    public var risks: [String]
    public var actions: [Action]
    public var questions: [String]
    public var readingPath: [String]
}

public enum DeepAnalysisPresentation: Equatable, Sendable {
    case idle
    case running
    case completed
    case failed

    public static func of(_ status: String?) -> DeepAnalysisPresentation {
        switch status {
        case "queued", "running": .running
        case "succeeded": .completed
        case "failed": .failed
        default: .idle
        }
    }

    public static func canRead(_ presentation: DeepAnalysisPresentation) -> Bool {
        presentation == .completed
    }

    public static let offlineSubmitAllowed = false
}

public enum DeepAnalysisAPIPaths {
    public static func submit(articleID: Int) -> String { "articles/\(articleID)/deep-analysis" }
    public static func versions(articleID: Int) -> String { "articles/\(articleID)/deep-analysis/versions" }
    public static func restore(articleID: Int, version: Int) -> String { "articles/\(articleID)/deep-analysis/\(version)/restore" }
}
