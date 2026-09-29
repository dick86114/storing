import Foundation
import QiankunjieCore

public protocol URLSessioning: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: URLSessioning {}

public struct APIClient: @unchecked Sendable {
    public static let defaultBaseURL = URL(string: "https://storing.idickies.cc/api/v1")!

    private let baseURL: URL
    private let session: any URLSessioning
    private let tokenProvider: (any TokenRefreshing)?

    public init(
        baseURL: URL = APIClient.defaultBaseURL,
        session: any URLSessioning = URLSession.shared,
        tokenProvider: (any TokenRefreshing)? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    public func send<T: Decodable & Sendable>(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> T {
        let result = try await perform(request, authenticated: authenticated, canRetryAfterRefresh: true)
        try validate(result.response, data: result.data)

        do {
            return try JSONDecoder.qiankunjie.decode(T.self, from: result.data)
        } catch {
            throw AppError.server
        }
    }

    private func perform(
        _ request: APIRequest,
        authenticated: Bool,
        canRetryAfterRefresh: Bool
    ) async throws -> (data: Data, response: HTTPURLResponse) {
        let urlRequest = try makeURLRequest(request)
        var authorizedRequest = urlRequest

        if authenticated {
            guard
                let tokenProvider,
                let accessToken = await tokenProvider.currentAccessToken(),
                !accessToken.isEmpty
            else {
                throw AppError.authenticationRequired
            }
            authorizedRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: authorizedRequest)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw AppError.network
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.network
        }

        if
            httpResponse.statusCode == 401,
            authenticated,
            canRetryAfterRefresh,
            let tokenProvider
        {
            _ = try await tokenProvider.refreshAccessToken()
            return try await perform(
                request,
                authenticated: true,
                canRetryAfterRefresh: false
            )
        }

        return (data, httpResponse)
    }

    private func makeURLRequest(_ request: APIRequest) throws -> URLRequest {
        let relativePath = request.path.hasPrefix("/")
            ? String(request.path.dropFirst())
            : request.path
        let url = baseURL.appendingPathComponent(relativePath)

        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw AppError.invalidInput
        }
        if !request.queryItems.isEmpty {
            components.queryItems = request.queryItems
        }
        guard let finalURL = components.url else {
            throw AppError.invalidInput
        }

        var urlRequest = URLRequest(url: finalURL)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.httpBody = request.body
        for (name, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }
        return urlRequest
    }

    private func validate(_ response: HTTPURLResponse, data: Data) throws {
        guard !(200..<300).contains(response.statusCode) else {
            return
        }
        throw mapError(statusCode: response.statusCode, data: data)
    }

    private func mapError(statusCode: Int, data: Data) -> AppError {
        let errorCode = (try? JSONDecoder.qiankunjie.decode(ServerErrorEnvelope.self, from: data))?.error.code

        switch errorCode {
        case "INVALID_CREDENTIALS", "INVALID_REFRESH_TOKEN", "UNAUTHORIZED", "TOKEN_EXPIRED":
            return .authenticationRequired
        case "FORBIDDEN", "USER_DISABLED":
            return .forbidden
        case "BAD_REQUEST", "INVALID_INPUT", "VALIDATION_ERROR":
            return .invalidInput
        case "NOT_FOUND", "CONTENT_UNAVAILABLE":
            return .contentUnavailable
        default:
            break
        }

        switch statusCode {
        case 400, 405, 409, 422:
            return .invalidInput
        case 401:
            return .authenticationRequired
        case 403:
            return .forbidden
        case 404:
            return .contentUnavailable
        case 408:
            return .network
        default:
            return .server
        }
    }
}

private struct ServerErrorEnvelope: Decodable {
    let error: ServerErrorBody
}

private struct ServerErrorBody: Decodable {
    let code: String?
}
