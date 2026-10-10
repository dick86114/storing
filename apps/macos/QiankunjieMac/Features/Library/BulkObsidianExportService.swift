import AppKit
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
    private let exporterFactory: @MainActor (ObsidianExportSettings) -> any BulkObsidianArticleExporting
    private let settings: ObsidianExportSettings
    private let dateFormatter: DateFormatter
    private let directorySelector: @MainActor () async throws -> URL

    init(
        detailLoader: any BulkObsidianDetailLoading,
        exporterFactory: @escaping @MainActor (ObsidianExportSettings) -> any BulkObsidianArticleExporting,
        settings: ObsidianExportSettings,
        directorySelector: @escaping @MainActor () async throws -> URL
    ) {
        self.detailLoader = detailLoader
        self.exporterFactory = exporterFactory
        self.settings = settings
        self.directorySelector = directorySelector
        dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
    }

    init(
        detailLoader: any BulkObsidianDetailLoading,
        exporter: any BulkObsidianArticleExporting,
        settings: ObsidianExportSettings,
        directorySelector: @escaping @MainActor () async throws -> URL
    ) {
        self.init(
            detailLoader: detailLoader,
            exporterFactory: { _ in exporter },
            settings: settings,
            directorySelector: directorySelector
        )
    }

    init(
        apiClient: APIClient,
        settingsStore: ObsidianExportSettingsStore = .init(),
        directorySelector: @escaping @MainActor () async throws -> URL = selectDestinationDirectory
    ) {
        let settings = settingsStore.load()
        self.init(
            detailLoader: BulkObsidianAPIDetailLoader(client: apiClient),
            exporterFactory: { effectiveSettings in
                ObsidianArticleExporter(settings: effectiveSettings)
            },
            settings: settings,
            directorySelector: directorySelector
        )
    }

    func export(articleIDs: [Int]) async throws -> BulkObsidianExportSummary {
        let selectedDirectory = try await directorySelector()
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(
            atPath: selectedDirectory.path,
            isDirectory: &isDirectory
        ), isDirectory.boolValue else {
            throw ObsidianExportError.directoryUnavailable
        }

        let exporter = exporterFactory(
            ObsidianExportSettings(
                directoryURL: selectedDirectory,
                conflictPolicy: settings.conflictPolicy
            )
        )

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

    static func selectDestinationDirectory() async throws -> URL {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        panel.prompt = "选择目录"
        panel.message = "选择批量导出 Obsidian 文件的目标目录"

        guard panel.runModal() == .OK, let directory = panel.url else {
            throw CancellationError()
        }

        return directory.standardizedFileURL
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
