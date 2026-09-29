import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieCollect

@MainActor
struct CollectModelTests {
    @Test func 提交成功后轮询到终态() async {
        let repository = 模拟采集仓库(statuses: ["pending", "running", "completed"])
        let model = CollectModel(repository: repository, userID: 9, pollInterval: .zero)

        await model.submit("https://example.com/article")

        #expect(model.currentJob?.status == "completed")
        #expect(model.currentJob?.articleId == 7)
        #expect(model.jobs.map(\.id) == [11])
        #expect(await repository.submitCount == 1)
    }

    @Test func 提交返回后进入任务状态并停止提交中() async {
        let repository = 模拟采集仓库(statuses: ["pending", "completed"])
        await repository.holdNextJob()
        let model = CollectModel(repository: repository, userID: 9, pollInterval: .zero)
        let submission = Task {
            await model.submit("https://example.com/article")
        }
        await repository.waitForJobRequest()

        #expect(model.isSubmitting == false)
        #expect(model.currentJob?.status == "pending")

        await repository.resumeHeldJob(with: .success(
            CollectJob.fixture(id: 11, status: "completed")
        ))
        await submission.value

        #expect(model.currentJob?.status == "completed")
    }

    @Test func 游客刷新不会请求任务列表() async {
        let repository = 模拟采集仓库()
        let model = CollectModel(repository: repository, userID: nil)

        await model.refreshJobs()

        #expect(await repository.jobsRequestCount == 0)
        #expect(!model.isLoadingJobs)
    }

    @Test func 无效地址不会调用提交接口() async {
        let repository = 模拟采集仓库(statuses: [])
        let model = CollectModel(repository: repository, userID: 9, pollInterval: .zero)

        await model.submit("http://127.0.0.1/article")

        #expect(model.currentJob == nil)
        #expect(model.inputErrorMessage != nil)
        #expect(await repository.submitCount == 0)
    }

    @Test func 提交失败保留错误并支持再次输入() async {
        let repository = 模拟采集仓库(error: AppError.network)
        let model = CollectModel(repository: repository, userID: 9, pollInterval: .zero)

        await model.submit("https://example.com/article")

        #expect(model.currentJob == nil)
        #expect(model.submitErrorMessage == "网络连接失败，请稍后重试")
        #expect(!model.isSubmitting)
    }

    @Test func 刷新任务后继续轮询活跃任务() async {
        let repository = 模拟采集仓库(
            page: CollectJobPage(
                jobs: [.fixture(id: 11, status: "pending")],
                total: 1,
                hasMore: false
            ),
            statuses: ["running", "completed"]
        )
        let model = CollectModel(repository: repository, userID: 9, pollInterval: .zero)

        await model.refreshJobs()

        #expect(model.jobs.map(\.status) == ["completed"])
        #expect(model.displayState == .content)
        #expect(await repository.jobsRequestCount == 1)
        #expect(await repository.jobRequestCount == 2)
    }

    @Test func 重试失败任务会轮询到新终态() async {
        let failed = CollectJob.fixture(id: 11, status: "failed")
		let repository = 模拟采集仓库(
			page: CollectJobPage(jobs: [failed], total: 1, hasMore: false),
			statuses: ["completed"],
			retryResult: .fixture(id: 11, status: "pending")
        )
        let model = CollectModel(repository: repository, userID: 9, initialJobs: [failed])

        await model.retry(jobID: 11)

        #expect(model.jobs.map(\.status) == ["completed"])
        #expect(await repository.retryIDs == [11])
        #expect(await repository.jobRequestCount == 1)
    }

    @Test func 终态任务确认删除并移出列表() async {
        let jobs = [
            CollectJob.fixture(id: 11, status: "completed"),
            CollectJob.fixture(id: 12, status: "pending"),
        ]
        let repository = 模拟采集仓库(page: CollectJobPage(jobs: jobs, total: 2, hasMore: false))
        let model = CollectModel(repository: repository, userID: 9, initialJobs: jobs)
        model.pendingDeletionJobID = 11

        await model.delete(jobID: 11)

        #expect(model.jobs.map(\.id) == [12])
        #expect(model.pendingDeletionJobID == nil)
        #expect(await repository.deleteIDs == [11])
    }

    @Test func 批量清理只移除已完成和失败任务() async {
        let jobs = [
            CollectJob.fixture(id: 11, status: "completed"),
            CollectJob.fixture(id: 12, status: "failed"),
            CollectJob.fixture(id: 13, status: "running"),
        ]
        let repository = 模拟采集仓库(
            page: CollectJobPage(jobs: jobs, total: 3, hasMore: false),
            clearedCount: 2
        )
        let model = CollectModel(repository: repository, userID: 9, initialJobs: jobs)
        model.isClearConfirmationPresented = true

        await model.clearFinished()

        #expect(model.jobs.map(\.id) == [13])
        #expect(!model.isClearConfirmationPresented)
        #expect(await repository.clearFinishedCount == 1)
    }

    @Test func 账号切换立即清理任务并丢弃旧响应() async throws {
        let repository = 模拟采集仓库(
            page: CollectJobPage(jobs: [.fixture(id: 11, status: "pending")], total: 1, hasMore: false)
        )
        await repository.holdNextJobs()
        let model = CollectModel(repository: repository, userID: 9)
        let oldRequest = Task {
            await model.refreshJobs()
        }
        await repository.waitForJobsRequest()

        model.prepareUser(userID: 10)
        #expect(model.jobs.isEmpty)
        #expect(model.currentJob == nil)

        await repository.resumeHeldJobs(with: .success(
            CollectJobPage(jobs: [.fixture(id: 11, status: "pending")], total: 1, hasMore: false)
        ))
        await oldRequest.value

        #expect(model.jobs.isEmpty)
        #expect(model.displayState == .loading)
        #expect(model.userID == 10)
    }
}

private actor 模拟采集仓库: CollectServicing {
    private let submitError: AppError?
    private var statuses: [String]
    private var page: CollectJobPage?
    private let retryResult: CollectJob
    private let clearedCount: Int
    private var shouldHoldNextJobs = false
    private var heldJobsContinuation: CheckedContinuation<CollectJobPage, Error>?
    private var shouldHoldNextJob = false
    private var heldJobContinuation: CheckedContinuation<CollectJob, Error>?

    private(set) var submitCount = 0
    private(set) var jobsRequestCount = 0
    private(set) var jobRequestCount = 0
    private(set) var retryIDs: [Int] = []
    private(set) var deleteIDs: [Int] = []
    private(set) var clearFinishedCount = 0

    init(
        page: CollectJobPage? = nil,
        statuses: [String] = [],
        error: AppError? = nil,
        retryResult: CollectJob = .fixture(id: 0, status: "pending"),
        clearedCount: Int = 0
    ) {
        self.page = page
        self.statuses = statuses
        self.submitError = error
        self.retryResult = retryResult
        self.clearedCount = clearedCount
    }

    func submit(url: URL) async throws -> CollectJob {
        submitCount += 1
        if let submitError {
            throw submitError
        }
        return .fixture(
            id: 11,
            status: statuses.first ?? "pending",
            url: url.absoluteString,
            articleID: statuses.first == "completed" ? 7 : nil
        )
    }

    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        jobsRequestCount += 1
        if shouldHoldNextJobs {
            shouldHoldNextJobs = false
            return try await withCheckedThrowingContinuation { continuation in
                heldJobsContinuation = continuation
            }
        }
        return page ?? CollectJobPage(jobs: [], total: 0, hasMore: false)
    }

    func job(id: Int) async throws -> CollectJob? {
        jobRequestCount += 1
        if shouldHoldNextJob {
            shouldHoldNextJob = false
            return try await withCheckedThrowingContinuation { continuation in
                heldJobContinuation = continuation
            }
        }
        guard !statuses.isEmpty else { return .fixture(id: id, status: "completed") }
        let status = statuses.removeFirst()
        return .fixture(
            id: id,
            status: status,
            articleID: status == "completed" ? 7 : nil
        )
    }

    func retry(id: Int) async throws -> CollectJob {
        retryIDs.append(id)
        return retryResult
    }

    func delete(id: Int) async throws -> Bool {
        deleteIDs.append(id)
        return true
    }

    func clearFinished() async throws -> Int {
        clearFinishedCount += 1
        return clearedCount
    }

    func holdNextJobs() {
        shouldHoldNextJobs = true
    }

    func holdNextJob() {
        shouldHoldNextJob = true
    }

    func waitForJobsRequest() async {
        while heldJobsContinuation == nil {
            await Task.yield()
        }
    }

    func resumeHeldJobs(with result: Result<CollectJobPage, Error>) {
        guard let continuation = heldJobsContinuation else { return }
        heldJobsContinuation = nil
        continuation.resume(with: result)
    }

    func waitForJobRequest() async {
        while heldJobContinuation == nil {
            await Task.yield()
        }
    }

    func resumeHeldJob(with result: Result<CollectJob, Error>) {
        guard let continuation = heldJobContinuation else { return }
        heldJobContinuation = nil
        continuation.resume(with: result)
    }
}

private extension CollectJob {
    static func fixture(
        id: Int,
        status: String,
        url: String = "https://example.com/article",
        articleID: Int? = nil
	) -> Self {
        let payload: [String: Any?] = [
            "id": id,
            "url": url,
            "normalizedUrl": url,
            "status": status,
            "stage": status,
            "method": "singlefile",
            "captureStrategy": "desktop",
            "articleId": articleID,
            "title": articleID == nil ? nil : "已完成文章",
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
