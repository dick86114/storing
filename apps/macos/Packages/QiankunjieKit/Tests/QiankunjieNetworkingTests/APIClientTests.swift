import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieNetworking

private struct 测试响应: Decodable, Sendable {
    let value: String
}

private actor 录制网络会话: URLSessioning {
    struct 响应: Sendable {
        let statusCode: Int
        let data: Data
        let headers: [String: String]

        init(statusCode: Int, data: Data, headers: [String: String] = [:]) {
            self.statusCode = statusCode
            self.data = data
            self.headers = headers
        }
    }

    private var 响应队列: [响应]
    private(set) var 请求列表: [URLRequest] = []

    init(_ 响应队列: [响应]) {
        self.响应队列 = 响应队列
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        请求列表.append(request)
        guard !响应队列.isEmpty else {
            throw URLError(.badServerResponse)
        }

        let 当前响应 = 响应队列.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 当前响应.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: 当前响应.headers
        )!
        return (当前响应.data, response)
    }
}

private actor 录制令牌提供者: TokenRefreshing {
    private var 访问令牌: String?
    private let 刷新结果: Result<String, AppError>
    private(set) var 刷新次数 = 0

    init(访问令牌: String?, 刷新结果: Result<String, AppError> = .success("new-access")) {
        self.访问令牌 = 访问令牌
        self.刷新结果 = 刷新结果
    }

    func currentAccessToken() async -> String? {
        访问令牌
    }

    func refreshAccessToken() async throws -> String {
        刷新次数 += 1
        let 新令牌 = try 刷新结果.get()
        访问令牌 = 新令牌
        return 新令牌
    }
}

@Test func 收到401时刷新令牌并只重试一次() async throws {
    let session = 录制网络会话([
        .init(statusCode: 401, data: #"{"error":{"code":"TOKEN_EXPIRED","message":"已过期"}}"#.data(using: .utf8)!),
        .init(statusCode: 200, data: #"{"value":"ok"}"#.data(using: .utf8)!),
    ])
    let tokens = 录制令牌提供者(访问令牌: "old-access")
    let client = APIClient(
        baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
        session: session,
        tokenProvider: tokens
    )

    let 响应: 测试响应 = try await client.send(.get("articles"), authenticated: true)
    let 请求列表 = await session.请求列表

    #expect(响应.value == "ok")
    #expect(请求列表.count == 2)
    #expect(请求列表[0].value(forHTTPHeaderField: "Authorization") == "Bearer old-access")
    #expect(请求列表[1].value(forHTTPHeaderField: "Authorization") == "Bearer new-access")
    #expect(await tokens.刷新次数 == 1)
}

@Test func 重试后再次收到401不会继续刷新() async throws {
    let unauthorized = #"{"error":{"code":"INVALID_REFRESH_TOKEN","message":"登录已失效"}}"#.data(using: .utf8)!
    let session = 录制网络会话([
        .init(statusCode: 401, data: unauthorized),
        .init(statusCode: 401, data: unauthorized),
    ])
    let tokens = 录制令牌提供者(访问令牌: "old-access")
    let client = APIClient(
        baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
        session: session,
        tokenProvider: tokens
    )

    await #expect(throws: AppError.authenticationRequired) {
        let _: 测试响应 = try await client.send(.get("articles"), authenticated: true)
    }

    #expect(await session.请求列表.count == 2)
    #expect(await tokens.刷新次数 == 1)
}

@Test func 非认证请求收到401不会刷新令牌() async throws {
    let session = 录制网络会话([
        .init(statusCode: 401, data: #"{"error":{"code":"INVALID_CREDENTIALS","message":"用户名或密码错误"}}"#.data(using: .utf8)!),
    ])
    let tokens = 录制令牌提供者(访问令牌: "old-access")
    let client = APIClient(
        baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
        session: session,
        tokenProvider: tokens
    )

    await #expect(throws: AppError.authenticationRequired) {
        let _: 测试响应 = try await client.send(.post("macos/auth/login"), authenticated: false)
    }

    #expect(await session.请求列表.count == 1)
    #expect(await tokens.刷新次数 == 0)
}

@Test func 服务端错误按状态和错误码映射() async throws {
    let cases: [(Int, String, AppError)] = [
        (400, "BAD_REQUEST", .invalidInput),
        (403, "USER_DISABLED", .forbidden),
        (404, "NOT_FOUND", .contentUnavailable),
        (429, "LOGIN_RATE_LIMITED", .server),
        (500, "INTERNAL_ERROR", .server),
    ]

    for (statusCode, code, expected) in cases {
        let body = #"{"error":{"code":"\#(code)","message":"测试"}}"#.data(using: .utf8)!
        let session = 录制网络会话([
            .init(statusCode: statusCode, data: body),
        ])
        let client = APIClient(
            baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
            session: session
        )

        await #expect(throws: expected) {
            let _: 测试响应 = try await client.send(.get("articles"), authenticated: false)
        }
    }
}

@Test func 成功响应解码蛇形命名字段() async throws {
    let session = 录制网络会话([
        .init(statusCode: 200, data: #"{"display_value":"乾坤戒"}"#.data(using: .utf8)!),
    ])
    let client = APIClient(
        baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
        session: session
    )

    struct 蛇形响应: Decodable, Sendable {
        let displayValue: String
    }

    let 响应: 蛇形响应 = try await client.send(.get("profile"), authenticated: false)
    #expect(响应.displayValue == "乾坤戒")
}
