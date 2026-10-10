import AppKit
import Foundation
import QiankunjieCore
import QiankunjieLibrary
import QiankunjieNetworking
import UniformTypeIdentifiers

enum BulkArticleExportError: Error, Equatable {
    case missingDownloadURL
    case exportFailed
}

@MainActor
struct BulkArticleExportService {
    private let bulkRepository: any LibraryBulkOperating
    private let tokenProvider: any TokenRefreshing
    private let baseURL: URL
    private let session: URLSession

    init(
        bulkRepository: any LibraryBulkOperating = LibraryRepository(),
        tokenProvider: any TokenRefreshing,
        baseURL: URL = APIClient.defaultBaseURL,
        session: URLSession = .shared
    ) {
        self.bulkRepository = bulkRepository
        self.tokenProvider = tokenProvider
        self.baseURL = baseURL
        self.session = session
    }

    nonisolated static func archiveName(for job: ArticleBulkExportJob) -> String {
        "storing-export-\(job.id).zip"
    }

    func poll(jobID: Int) async throws -> ArticleBulkExportJob {
        var job = try await bulkRepository.runBulkExportJob(jobID: jobID)

        while job.status == .queued || job.status == .running {
            try await Task.sleep(nanoseconds: 1_500_000_000)
            job = try await bulkRepository.runBulkExportJob(jobID: jobID)
        }

        guard job.status == .succeeded else {
            throw BulkArticleExportError.exportFailed
        }

        return job
    }

    func save(_ job: ArticleBulkExportJob) async throws -> URL {
        guard let downloadText = job.downloadURL else {
            throw BulkArticleExportError.missingDownloadURL
        }

        let downloadURL = URL(string: downloadText, relativeTo: baseURL) ?? URL(fileURLWithPath: downloadText)
        var request = URLRequest(url: downloadURL)
        request.httpMethod = "GET"

        guard let accessToken = await tokenProvider.currentAccessToken(), !accessToken.isEmpty else {
            throw AppError.authenticationRequired
        }
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard
            let httpResponse = response as? HTTPURLResponse,
            (200..<300).contains(httpResponse.statusCode)
        else {
            throw AppError.server
        }

        let panel = NSSavePanel()
        panel.canCreateDirectories = true
        panel.nameFieldStringValue = Self.archiveName(for: job)
        panel.allowedContentTypes = [.zip]

        guard panel.runModal() == .OK, let destination = panel.url else {
            throw CancellationError()
        }

        try data.write(to: destination, options: .atomic)
        NSWorkspace.shared.activateFileViewerSelecting([destination])
        return destination
    }
}
