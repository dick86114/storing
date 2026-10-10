import Foundation
import QiankunjieCore
import QiankunjieReader
import QiankunjieNetworking

struct BulkObsidianExportFailure: Equatable, Sendable {
    let articleID: Int
    let message: String
}

struct BulkObsidianExportSummary: Equatable, Sendable {
    let succeededIDs: [Int]
    let failures: [BulkObsidianExportFailure]
}

protocol BulkObsidianDetailLoading: Sendable {
    func load(articleID: Int) async throws -> ArticleDetail
}

protocol BulkObsidianArticleExporting: Sendable {
    func export(_ document: ArticleExportDocument) throws -> URL
}

@MainActor
struct BulkObsidianExportService {
    private let detailLoader: any BulkObsidianDetailLoading
    private let exporter: any BulkObsidianArticleExporting
    private let settings: ObsidianExportSettings
    private let dateFormatter: DateFormatter

    init(
        detailLoader: any BulkObsidianDetailLoading,
        exporter: any BulkObsidianArticleExporting,
        settings: ObsidianExportSettings
    ) {
        self.detailLoader = detailLoader
        self.exporter = exporter
        self.settings = settings
        dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
    }

    init(
        apiClient: APIClient,
        settingsStore: ObsidianExportSettingsStore = .init()
    ) {
        let settings = settingsStore.load()
        self.init(
            detailLoader: BulkObsidianAPIDetailLoader(client: apiClient),
            exporter: ObsidianArticleExporter(settings: settings),
            settings: settings
        )
    }

    func export(articleIDs: [Int]) async throws -> BulkObsidianExportSummary {
        guard settings.directoryURL != nil else {
            throw ObsidianExportError.notConfigured
        }

        var succeededIDs: [Int] = []
        var failures: [BulkObsidianExportFailure] = []

        for articleID in articleIDs {
            do {
                let detail = try await detailLoader.load(articleID: articleID)
                _ = try exporter.export(document(for: detail))
                succeededIDs.append(articleID)
            } catch {
                failures.append(
                    BulkObsidianExportFailure(
                        articleID: articleID,
                        message: error.localizedDescription
                    )
                )
            }
        }

        return BulkObsidianExportSummary(succeededIDs: succeededIDs, failures: failures)
    }

    private func document(for detail: ArticleDetail) -> ArticleExportDocument {
        ArticleExportDocument(
            title: detail.title,
            author: detail.author,
            source: detail.source,
            originalURL: detail.originalURL,
            publishedAt: detail.publishTime.map(dateFormatter.string(from:)),
            savedAt: detail.createdAt.map(dateFormatter.string(from:)),
            aiSummary: detail.aiSummary,
            category: detail.category?.name,
            tags: detail.aiTags,
            contentMarkdown: detail.contentMarkdown,
            contentHTML: detail.contentHTML
        )
    }
}

private struct BulkObsidianAPIDetailLoader: BulkObsidianDetailLoading {
    let client: any ReaderNetworkClient

    func load(articleID: Int) async throws -> ArticleDetail {
        try await client.articleDetail(
            ReaderSelection(articleID: articleID, publicID: nil, isGuest: false)
        )
    }
}

extension ObsidianArticleExporter: BulkObsidianArticleExporting {}
