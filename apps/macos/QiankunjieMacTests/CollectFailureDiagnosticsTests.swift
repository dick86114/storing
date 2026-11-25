import Foundation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct CollectFailureDiagnosticsTests {
    @Test func 导出保留任务诊断并隐藏常见凭据() throws {
        let job = try makeJob(
            url: "https://example.com/article?signature=private-signature#private-fragment",
            normalizedURL: "https://example.com/article",
            error: "Reader HTTP 502\nAuthorization: Bearer private-token\nCookie: session=private-cookie",
            summary: "抓取结果异常",
            details: ["桌面抓取：HTTP 502 https://example.com/article?token=private-query", "移动抓取超时"],
            hint: "稍后重试"
        )
        let diagnostics = CollectFailureDiagnostics(job: job)
        let report = diagnostics.exportText(appVersion: "1.2.3", systemVersion: "macOS test")

        #expect(diagnostics.suggestedFilename == "storing-collect-error-42.txt")
        for text in ["42", "singlefile_sidecar", "2026-11-26T09:30:00Z", "1.2.3", "macOS test",
                     "抓取结果异常", "稍后重试", "桌面抓取：HTTP 502", "移动抓取超时", "Reader HTTP 502", "https://example.com/article"] {
            #expect(report.contains(text))
        }
        for text in ["private-signature", "private-fragment", "private-token", "private-cookie", "private-query"] {
            #expect(!report.contains(text))
        }
    }

    @Test func 日志缺字段时优先使用原始错误并提供空日志说明() throws {
        let rawError = "请求超时"
        let withError = CollectFailureDiagnostics(job: try makeJob(error: rawError))
        let withoutError = CollectFailureDiagnostics(job: try makeJob(details: nil))
        #expect(withError.summary == rawError)
        #expect(withError.logText == rawError)
        #expect(withoutError.summary == "采集失败")
        #expect(withoutError.logText == "服务端未返回错误日志。")
    }

    @Test func 链接操作优先使用原链接并拒绝非网页地址() throws {
        let url = "https://example.com/article?ref=original#section"
        let original = try makeJob(url: url, normalizedURL: "https://example.com/article")
        let fallback = try makeJob(url: "file:///private/file", normalizedURL: "https://example.com/article")
        let invalid = try makeJob(url: "javascript:alert(1)", normalizedURL: "file:///private/file")
        #expect(CollectTaskLink.url(for: original)?.absoluteString == url)
        #expect(CollectTaskLink.url(for: fallback)?.absoluteString == "https://example.com/article")
        #expect(CollectTaskLink.url(for: invalid) == nil)
    }

    @MainActor
    @Test func 历史任务详情跟随刷新和账号切换() async throws {
        let failed = try makeJob(error: "请求超时")
        let updated = try makeJob(error: "连接失败")
        let completed = try makeJob(status: "completed", articleID: 9)
        let history = TaskHistoryRepository(jobs: [failed])
        let model = AppModel(collectRepository: history)
        model.user = AuthenticatedUser(id: 7, username: "reader", role: "user", status: "active")
        model.destination = .collectHistory
        model.collectModel.prepareUser(userID: 7)
        await model.collectModel.refreshJobs()

        model.selectCollectHistoryJob(failed)
        #expect(model.selectedFailedCollectJob == failed)
        #expect(model.selectedArticleID == nil)

        await history.replaceJobs(with: [updated])
        await model.collectModel.refreshJobs()
        #expect(model.selectedFailedCollectJob == updated)

        await history.replaceJobs(with: [completed])
        await model.collectModel.refreshJobs()
        #expect(model.selectedFailedCollectJob == nil)
        model.selectCollectHistoryJob(completed)
        #expect(model.selectedArticleID == 9)

        await history.replaceJobs(with: [failed])
        await model.collectModel.refreshJobs()
        model.selectCollectHistoryJob(failed)
        model.collectModel.prepareUser(userID: 8)
        #expect(model.selectedFailedCollectJob == nil)
    }

    private func makeJob(
        status: String = "failed",
        articleID: Int? = nil,
        url: String = "https://example.com/article",
        normalizedURL: String = "https://example.com/article",
        error: String? = nil,
        summary: String? = nil,
        details: [String]? = [],
        hint: String? = nil
    ) throws -> CollectJob {
        var payload: [String: Any] = [
            "id": 42, "url": url, "normalizedUrl": normalizedURL,
            "status": status, "stage": status, "method": "singlefile", "articleId": articleID as Any,
            "captureStrategy": "singlefile_sidecar", "error": error as Any,
            "errorSummary": summary as Any, "errorHint": hint as Any,
            "createdAt": "2026-11-26T09:30:00Z",
        ]
        if let details { payload["errorDetails"] = details }
        return try JSONDecoder.qiankunjie.decode(CollectJob.self, from: JSONSerialization.data(withJSONObject: payload))
    }
}

private actor TaskHistoryRepository: CollectServicing {
    var records: [CollectJob]

    init(jobs: [CollectJob]) { records = jobs }

    func replaceJobs(with jobs: [CollectJob]) { records = jobs }

    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        CollectJobPage(jobs: records, total: records.count, hasMore: false)
    }

    func job(id: Int) async throws -> CollectJob? { records.first { $0.id == id } }

    func submit(url: URL) async throws -> CollectJob { throw AppError.invalidInput }
    func retry(id: Int) async throws -> CollectJob { throw AppError.invalidInput }
    func delete(id: Int) async throws -> Bool { false }
    func clearFinished() async throws -> Int { 0 }
}
