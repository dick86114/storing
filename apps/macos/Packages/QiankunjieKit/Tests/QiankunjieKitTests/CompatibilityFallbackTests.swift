import Foundation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieNetworking
import Testing
@testable import QiankunjieCollect

private actor 录制兼容会话: URLSessioning {
    struct 响应 {
        let statusCode: Int
        let body: Data
    }

    private var 响应队列: [响应]
    private(set) var 请求路径: [String] = []

    init(_ 响应队列: [响应]) {
        self.响应队列 = 响应队列
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        请求路径.append(request.url?.path ?? "")
        guard let 当前 = 响应队列.isEmpty ? nil : 响应队列.removeFirst() else {
            throw URLError(.badServerResponse)
        }

        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 当前.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (当前.body, response)
    }

    func waitForRequests(_ count: Int) async {
        while 请求路径.count < count {
            await Task.yield()
        }
    }

    func reset() { 请求路径 = [] }
}

private actor 固定令牌: TokenRefreshing {
    func currentAccessToken() async -> String? { "access-token" }
    func refreshAccessToken() async throws -> String { "access-token" }
}

@Test func 登录在旧服务端缺少macOS接口时回退mobile登录() async throws {
    let session = 录制兼容会话([
        .init(statusCode: 404, body: Data("404 Not Found".utf8)),
        .init(statusCode: 200, body: Data(#"""
        {
          "access_token": "access",
          "refresh_token": "refresh-token",
          "user": {"id": 9, "username": "admin", "role": "admin", "status": "active"},
          "session": {"id": "legacy-session", "expires_at": "2026-12-01T00:00:00.000Z"}
        }
        """#.data(using: .utf8)!)),
    ])
    let client = DefaultAuthClient(apiClient: APIClient(session: session))

    let response = try await client.login(
        username: "admin",
        password: "password",
        device: AuthDevice(id: "device", name: "Mac", appVersion: "0.1.0")
    )
    let paths = await session.请求路径

    #expect(response.user.id == 9)
    #expect(paths.last == "/api/v1/mobile/auth/login")
    #expect(paths.contains("/api/v1/macos/auth/login"))
}

@Test func 采集在旧服务端缺少macOS接口时回退mobile采集() async throws {
    let session = 录制兼容会话([
        .init(statusCode: 404, body: Data("404 Not Found".utf8)),
        .init(statusCode: 202, body: Data(#"""
        {"job":{"id":11,"url":"https://example.com/a","normalizedUrl":"https://example.com/a","status":"pending","stage":"queued","errorDetails":[],"createdAt":"2026-09-30T00:00:00.000Z","updatedAt":"2026-09-30T00:00:00.000Z","startedAt":null,"finishedAt":null}}
        """#.data(using: .utf8)!)),
    ])
    let repository = CollectRepository(
        apiClient: APIClient(session: session, tokenProvider: 固定令牌())
    )

    let paths = await session.请求路径
    var job: CollectJob?
    do {
        job = try await repository.submit(url: URL(string: "https://example.com/a")!)
    } catch {
        Issue.record("采集错误：\(error)；请求路径：\(paths)")
    }

    await session.waitForRequests(2)
    let updatedPaths = await session.请求路径

    #expect(job?.id == 11)
    #expect(updatedPaths.last == "/api/v1/mobile/collect")
    #expect(updatedPaths.contains("/api/v1/macos/collect"))
}
