import Foundation
import XCTest
import QiankunjieCore
@testable import QiankunjieCollect

@MainActor
final class CollectRetryConcurrencyTests: XCTestCase {
    func testRetryPollingSurvivesConcurrentRefresh() async {
        let failed = CollectJob.fixture(id: 12, status: "failed")
        let repository = RetryConcurrencyRepository(
            page: CollectJobPage(jobs: [failed], total: 1, hasMore: false),
            statuses: ["pending"],
            retryResult: .fixture(id: 12, status: "pending")
        )
        let model = CollectModel(repository: repository, userID: 9, initialJobs: [failed])

        await model.refreshJobs()
        await repository.pauseJobPolls(afterRequestCount: 1)

        let retry = Task {
            await model.retry(jobID: 12)
        }
        await repository.waitForPausedJobPoll()
        await model.refreshJobs()
        await repository.resumePausedJobPoll(with: CollectJob.fixture(id: 12, status: "pending"))
        await retry.value

        let retryIDs = await repository.retryIDs
        let jobRequestCount = await repository.jobRequestCount
        XCTAssertEqual(retryIDs, [12])
        XCTAssertGreaterThanOrEqual(jobRequestCount, 2)
        XCTAssertFalse(model.mutatingJobIDs.contains(12))
        XCTAssertEqual(model.jobs.first { $0.id == 12 }?.status, "completed")
    }
}

private actor RetryConcurrencyRepository: CollectServicing {
    let page: CollectJobPage
    var statuses: [String]
    let retryResult: CollectJob
    private var pauseAfterJobRequestCount: Int?
    private var pausedContinuation: CheckedContinuation<CollectJob, Error>?
    private(set) var retryIDs: [Int] = []
    private(set) var jobRequestCount = 0

    init(page: CollectJobPage, statuses: [String], retryResult: CollectJob) {
        self.page = page
        self.statuses = statuses
        self.retryResult = retryResult
    }

    func submit(url: URL) async throws -> CollectJob {
        retryResult
    }

    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        page
    }

    func job(id: Int) async throws -> CollectJob? {
        jobRequestCount += 1
        if let pauseAfterJobRequestCount, jobRequestCount >= pauseAfterJobRequestCount, pausedContinuation == nil {
            return try await withCheckedThrowingContinuation { continuation in
                pausedContinuation = continuation
            }
        }
        guard !statuses.isEmpty else { return .fixture(id: id, status: "completed") }
        let status = statuses.removeFirst()
        return .fixture(id: id, status: status)
    }

    func retry(id: Int) async throws -> CollectJob {
        retryIDs.append(id)
        return retryResult
    }

    func delete(id: Int) async throws -> Bool {
        true
    }

    func clearFinished() async throws -> Int {
        0
    }

    func pauseJobPolls(afterRequestCount count: Int) {
        pauseAfterJobRequestCount = count
    }

    func waitForPausedJobPoll() async {
        while pausedContinuation == nil {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    func resumePausedJobPoll(with job: CollectJob) {
        guard let continuation = pausedContinuation else { return }
        pausedContinuation = nil
        pauseAfterJobRequestCount = nil
        continuation.resume(returning: job)
    }
}

private extension CollectJob {
    static func fixture(id: Int, status: String) -> Self {
        let payload: [String: Any?] = [
            "id": id,
            "url": "https://example.com/article",
            "normalizedUrl": "https://example.com/article",
            "status": status,
            "stage": status,
            "method": "singlefile",
            "captureStrategy": "desktop",
            "articleId": nil,
            "title": nil,
            "error": status == "failed" ? "采集失败" : nil,
            "errorSummary": status == "failed" ? "采集失败" : nil,
            "errorDetails": [String](),
            "errorHint": status == "failed" ? "请重试" : nil,
            "createdAt": nil,
            "updatedAt": nil,
            "startedAt": nil,
            "finishedAt": nil,
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        return try! JSONDecoder.qiankunjie.decode(CollectJob.self, from: data)
    }
}
