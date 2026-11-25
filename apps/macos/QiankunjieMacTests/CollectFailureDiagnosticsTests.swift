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
        #expect(report.contains("signature=[已隐藏]"))
        #expect(CollectFailureDiagnostics(job: job).displayURL == "https://example.com/article?signature=[已隐藏]")
        for text in ["private-signature", "private-fragment", "private-token", "private-cookie", "private-query"] {
            #expect(!report.contains(text))
        }
    }

    @Test func 脱敏覆盖JSON键多段认证头和不应改写的远程路径() {
        let raw = #"{"token":"json-secret", "accessToken":"camel-secret", "password": "json-pass"}"#
            + "\nAuthorization: Basic dXNlcjpwYXNz\n"
            + "Authorization: Token raw-secret\n"
            + "Cookie: sid=first-secret; theme=second-secret\n"
            + "Reader proxy failed: Proxy-Authorization: Basic inline-secret\n"
            + "open \"/Users/alice/My Documents/private-filename.log\" failed\n"
            + "https://example.com/home/article https://example.com/private/article"
        let redacted = CollectFailureDiagnostics.redact(raw)

        for secret in ["json-secret", "camel-secret", "json-pass", "dXNlcjpwYXNz", "raw-secret", "first-secret", "second-secret", "inline-secret", "/Users/alice", "private-filename.log"] {
            #expect(!redacted.contains(secret))
        }
        #expect(redacted.contains("https://example.com/home/article"))
        #expect(redacted.contains("https://example.com/private/article"))
    }

    @Test func 导出日志隐藏凭据变体文件路径和链接路径秘密() throws {
        let rawError = """
        session_token=session-secret
        id_token=id-secret
        csrf_token=csrf-secret
        signature=signature-secret
        Set-Cookie: session=cookie-secret
        --cookie "session=cli-cookie-secret"
        Authorization: Bearer auth-secret
        file:///Users/alice/Library/private.txt
        https://example.com/reset/path-secret?access_token=query-secret
        """
        let report = CollectFailureDiagnostics(job: try makeJob(error: rawError))
            .exportText(appVersion: "1.2.3", systemVersion: "macOS test")
        for secret in ["session-secret", "id-secret", "csrf-secret", "signature-secret", "cookie-secret", "cli-cookie-secret", "auth-secret", "/Users/alice", "path-secret", "query-secret"] {
            #expect(!report.contains(secret), "Leaked: \(secret); report: \(report)")
        }
    }

    @Test func 显示给用户的错误文本与导出文本使用相同脱敏结果() throws {
        let diagnostics = CollectFailureDiagnostics(job: try makeJob(
            error: "Authorization: Bearer visible-secret",
            summary: "session_token=visible-session",
            details: ["file:///Users/alice/secret.log"],
            hint: "signature=visible-signature"
        ))
        let visible = [diagnostics.summary, diagnostics.logText, diagnostics.details.joined(), diagnostics.hint ?? ""].joined(separator: "\n")
        let report = diagnostics.exportText(appVersion: "1", systemVersion: "macOS")
        for secret in ["visible-secret", "visible-session", "visible-signature", "/Users/alice"] {
            #expect(!visible.contains(secret))
            #expect(!report.contains(secret))
        }
    }

    @Test func 日志缺字段时优先使用原始错误并提供空日志说明() throws {
        let rawError = "请求超时"
        let withoutError = try makeJob(details: nil)
        let withEmptyDetails = try makeJob(details: [])
        let withError = CollectFailureDiagnostics(job: try makeJob(error: rawError))
        #expect(withoutError == withEmptyDetails)
        #expect(Set([withoutError, withEmptyDetails]).count == 1)
        let noLog = CollectFailureDiagnostics(job: withoutError)
        #expect(withError.summary == rawError)
        #expect(withError.logText == rawError)
        #expect(noLog.summary == "采集失败")
        #expect(noLog.logText == "服务端未返回错误日志。")
    }

    @Test func 缺少标题时详情和历史行使用脱敏链接() throws {
        let job = try makeJob(url: "https://example.com/article?token=private-token&next=private-destination")
        let diagnostics = CollectFailureDiagnostics(job: job)
        #expect(diagnostics.displayTitle == "https://example.com/article?token=[已隐藏]&next=[已隐藏]")
        #expect(CollectTaskLink.url(for: job)?.absoluteString == job.url)
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

    @MainActor
    @Test func 刷新移除失败任务后详情不会因同一任务再次失败而自动重开() async throws {
        let failed = try makeJob(error: "首次失败")
        let history = TaskHistoryRepository(jobs: [failed])
        let model = AppModel(collectRepository: history)
        model.user = AuthenticatedUser(id: 7, username: "reader", role: "user", status: "active")
        model.destination = .collectHistory
        model.collectModel.prepareUser(userID: 7)
        await model.collectModel.refreshJobs()
        model.selectCollectHistoryJob(failed)
        #expect(model.selectedFailedCollectJob != nil)

        await history.replaceJobs(with: [])
        await model.collectModel.refreshJobs()
        #expect(model.selectedFailedCollectJob == nil)

        await history.replaceJobs(with: [failed])
        await model.collectModel.refreshJobs()
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
