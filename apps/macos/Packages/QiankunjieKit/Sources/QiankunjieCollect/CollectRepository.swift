import Foundation
import QiankunjieCore
import QiankunjieNetworking

public struct CollectJobPage: Hashable, Sendable {
    public let jobs: [CollectJob]
    public let total: Int
    public let hasMore: Bool

    public init(jobs: [CollectJob], total: Int, hasMore: Bool) {
        self.jobs = jobs
        self.total = total
        self.hasMore = hasMore
    }
}

public protocol CollectServicing: Sendable {
    func submit(url: URL) async throws -> CollectJob
    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage
    func job(id: Int) async throws -> CollectJob?
    func retry(id: Int) async throws -> CollectJob
    func delete(id: Int) async throws -> Bool
    func clearFinished() async throws -> Int
}

private struct CollectJobEnvelope: Decodable {
    let job: CollectJob
}

private struct CollectJobsEnvelope: Decodable {
    let jobs: [CollectJob]
    let total: Int
    let hasMore: Bool
}

private struct CollectDeletedEnvelope: Decodable {
    let deleted: Bool
}

private struct CollectClearedEnvelope: Decodable {
    let deletedCount: Int
}

public struct CollectRepository: CollectServicing {
    private let apiClient: APIClient

    public init(apiClient: APIClient = APIClient()) {
        self.apiClient = apiClient
    }

    public func submit(url: URL) async throws -> CollectJob {
        let body = try JSONEncoder().encode(["url": url.absoluteString])
        let response: CollectJobEnvelope = try await request(
            primary: .post("macos/collect", body: body),
            fallback: .post("mobile/collect", body: body),
            authenticated: true
        )
        return response.job
    }

    public func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        let primary = APIRequest.get(
                "macos/collect/jobs",
                queryItems: [
                    URLQueryItem(name: "limit", value: String(limit)),
                    URLQueryItem(name: "offset", value: String(offset)),
                ]
        )
        let fallback = APIRequest.get(
            "mobile/collect/jobs",
            queryItems: [
                URLQueryItem(name: "limit", value: String(limit)),
                URLQueryItem(name: "offset", value: String(offset)),
            ]
        )
        let response: CollectJobsEnvelope = try await request(
            primary: primary,
            fallback: fallback,
            authenticated: true
        )
        return CollectJobPage(
            jobs: response.jobs,
            total: response.total,
            hasMore: response.hasMore
        )
    }

    public func job(id: Int) async throws -> CollectJob? {
        let response: CollectJobEnvelope = try await request(
            primary: .get("macos/collect/jobs/\(id)"),
            fallback: .get("mobile/collect/jobs/\(id)"),
            authenticated: true
        )
        return response.job
    }

    public func retry(id: Int) async throws -> CollectJob {
        let response: CollectJobEnvelope = try await request(
            primary: .post("macos/collect/jobs/\(id)/retry"),
            fallback: .post("mobile/collect/jobs/\(id)/retry"),
            authenticated: true
        )
        return response.job
    }

    public func delete(id: Int) async throws -> Bool {
        let response: CollectDeletedEnvelope = try await request(
            primary: .delete("macos/collect/jobs/\(id)"),
            fallback: .delete("mobile/collect/jobs/\(id)"),
            authenticated: true
        )
        return response.deleted
    }

    public func clearFinished() async throws -> Int {
        let response: CollectClearedEnvelope = try await request(
            primary: .delete("macos/collect/jobs"),
            fallback: .delete("mobile/collect/jobs"),
            authenticated: true
        )
        return response.deletedCount
    }

    private func request<T: Decodable & Sendable>(
        primary: APIRequest,
        fallback: APIRequest,
        authenticated: Bool
    ) async throws -> T {
        do {
            return try await apiClient.send(primary, authenticated: authenticated)
        } catch AppError.contentUnavailable {
            // 旧版服务端还没有 macOS 来源；回退到现有 mobile 采集契约。
            return try await apiClient.send(fallback, authenticated: authenticated)
        } catch let error as DecodingError {
            throw AppError.server
        } catch {
            throw error
        }
    }
}
