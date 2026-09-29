import Foundation

public enum HTTPMethod: String, Equatable, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

public struct APIRequest: Sendable {
    public let method: HTTPMethod
    public let path: String
    public let queryItems: [URLQueryItem]
    public let headers: [String: String]
    public let body: Data?

    public init(
        method: HTTPMethod,
        path: String,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:],
        body: Data? = nil
    ) {
        self.method = method
        self.path = path
        self.queryItems = queryItems
        self.headers = headers
        self.body = body
    }

    public static func get(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) -> APIRequest {
        APIRequest(method: .get, path: path, queryItems: queryItems, headers: headers)
    }

    public static func post(
        _ path: String,
        headers: [String: String] = [:],
        body: Data? = nil
    ) -> APIRequest {
        APIRequest(
            method: .post,
            path: path,
            headers: headers.merging(["Content-Type": "application/json"]) { current, _ in current },
            body: body
        )
    }

    public static func put(
        _ path: String,
        headers: [String: String] = [:],
        body: Data? = nil
    ) -> APIRequest {
        APIRequest(
            method: .put,
            path: path,
            headers: headers.merging(["Content-Type": "application/json"]) { current, _ in current },
            body: body
        )
    }

    public static func patch(
        _ path: String,
        headers: [String: String] = [:],
        body: Data? = nil
    ) -> APIRequest {
        APIRequest(
            method: .patch,
            path: path,
            headers: headers.merging(["Content-Type": "application/json"]) { current, _ in current },
            body: body
        )
    }

    public static func delete(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) -> APIRequest {
        APIRequest(method: .delete, path: path, queryItems: queryItems, headers: headers)
    }
}
