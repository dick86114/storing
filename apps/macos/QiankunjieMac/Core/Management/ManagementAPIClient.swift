import Foundation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieNetworking

struct ManagementAPIClient: Sendable {
    private let client: APIClient

    init(repository: AuthRepository) {
        client = APIClient(tokenProvider: repository)
    }

    func get<Response: Decodable & Sendable>(_ path: String) async throws -> Response {
        try await get(path, queryItems: [])
    }

    func get<Response: Decodable & Sendable>(
        _ path: String,
        queryItems: [URLQueryItem]
    ) async throws -> Response {
        try await client.send(
            APIRequest(method: .get, path: path, queryItems: queryItems),
            authenticated: true
        )
    }

    func send<Response: Decodable & Sendable, Body: Encodable & Sendable>(
        _ path: String,
        method: HTTPMethod,
        body: Body
    ) async throws -> Response {
        let bodyData = try JSONEncoder().encode(body)
        return try await client.send(
            APIRequest(
                method: method,
                path: path,
                headers: ["Content-Type": "application/json"],
                body: bodyData
            ),
            authenticated: true
        )
    }

    func delete<Response: Decodable & Sendable>(
        _ path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Response {
        try await client.send(
            APIRequest(method: .delete, path: path, queryItems: queryItems),
            authenticated: true
        )
    }
}

func managementErrorMessage(for error: any Error) -> String {
    guard let appError = error as? AppError else {
        return "操作失败，请稍后重试"
    }

    switch appError {
    case .network:
        return "无法连接服务器，请检查网络后重试"
    case .authenticationRequired:
        return "登录状态已过期，请重新登录"
    case .forbidden:
        return "当前账号无权执行此操作"
    case .rateLimited:
        return "操作过于频繁，请稍后再试"
    case .contentUnavailable:
        return "请求的内容不存在或已失效"
    case .invalidInput:
        return "输入内容无效，请检查后重试"
    case .server:
        return "服务暂时不可用，请稍后重试"
    }
}
