import Foundation
import QiankunjieCore
import QiankunjieNetworking
import Testing
@testable import QiankunjieMac

private actor 合并请求录制会话: URLSessioning {
    private var 请求: URLRequest?

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        请求 = request
        let 响应 = HTTPURLResponse(
            url: try #require(request.url),
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (Data(#"{"ok":true}"#.utf8), 响应)
    }

    func 获取请求() -> URLRequest? {
        请求
    }
}

private struct 固定访问令牌: TokenRefreshing {
    func currentAccessToken() async -> String? {
        "test-access-token"
    }

    func refreshAccessToken() async throws -> String {
        "test-access-token"
    }
}

struct CategoryCatalogServiceTests {
    @Test func 合并分类请求编码使用后端字段() async throws {
        let session = 合并请求录制会话()
        let apiClient = APIClient(
            baseURL: URL(string: "https://storing.idickies.cc/api/v1")!,
            session: session,
            tokenProvider: 固定访问令牌()
        )
        let service = CategoryCatalogService(client: ManagementAPIClient(client: apiClient))

        try await service.merge(sourceCategoryID: 12, targetCategoryID: 34)

        let request = try #require(await session.获取请求())
        let body = try #require(request.httpBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Int])

        #expect(request.url?.path == "/api/v1/categories/merge")
        #expect(request.httpMethod == "POST")
        #expect(json["sourceCategoryId"] == 12)
        #expect(json["targetCategoryId"] == 34)
        #expect(json["sourceCategoryID"] == nil)
        #expect(json["targetCategoryID"] == nil)
    }
}
