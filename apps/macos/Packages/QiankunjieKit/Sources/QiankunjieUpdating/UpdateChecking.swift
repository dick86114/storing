import Foundation

public protocol UpdateChecking: Sendable {
    func checkForUpdate() async throws -> AppRelease?
}

public protocol UpdateDownloading: Sendable {
    func download(
        _ release: AppRelease,
        progress: @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate
}

public struct UpdateDataResponse: Sendable {
    public let data: Data
    public let statusCode: Int
    public let headers: [String: String]

    public init(data: Data, statusCode: Int, headers: [String: String]) {
        self.data = data
        self.statusCode = statusCode
        self.headers = headers
    }
}

/// 更新包字节流使用闭包包装，便于测试注入有限字节序列。
public struct UpdateByteStream: @unchecked Sendable, AsyncSequence {
    public typealias Element = UInt8
    public typealias AsyncIterator = UpdateByteIterator

    let makeStream: @Sendable () -> AsyncThrowingStream<UInt8, Error>

    public init(makeStream: @escaping @Sendable () -> AsyncThrowingStream<UInt8, Error>) {
        self.makeStream = makeStream
    }

    public func makeAsyncIterator() -> UpdateByteIterator {
        UpdateByteIterator(iterator: makeStream().makeAsyncIterator())
    }
}

public struct UpdateByteIterator: AsyncIteratorProtocol, @unchecked Sendable {
    var iterator: AsyncThrowingStream<UInt8, Error>.Iterator

    public init(iterator: AsyncThrowingStream<UInt8, Error>.Iterator) {
        self.iterator = iterator
    }

    public mutating func next() async throws -> UInt8? {
        try await iterator.next()
    }
}

public struct UpdateStreamResponse: Sendable {
    public let bytes: UpdateByteStream
    public let statusCode: Int
    public let headers: [String: String]

    public init(bytes: UpdateByteStream, statusCode: Int, headers: [String: String]) {
        self.bytes = bytes
        self.statusCode = statusCode
        self.headers = headers
    }
}

public protocol UpdateNetworkClient: Sendable {
    func data(for request: URLRequest) async throws -> UpdateDataResponse
    func stream(for request: URLRequest) async throws -> UpdateStreamResponse
}

public struct URLSessionUpdateNetworkClient: UpdateNetworkClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func data(for request: URLRequest) async throws -> UpdateDataResponse {
        let (data, response) = try await session.data(for: request)
        let httpResponse = try Self.httpResponse(response)
        return UpdateDataResponse(
            data: data,
            statusCode: httpResponse.statusCode,
            headers: Dictionary(uniqueKeysWithValues: httpResponse.allHeaderFields.map {
                (String(describing: $0.key), String(describing: $0.value))
            })
        )
    }

    public func stream(for request: URLRequest) async throws -> UpdateStreamResponse {
        let (byteStream, response) = try await session.bytes(for: request)
        let httpResponse = try Self.httpResponse(response)
        return UpdateStreamResponse(
            bytes: Self.makeByteStream(from: byteStream),
            statusCode: httpResponse.statusCode,
            headers: Dictionary(uniqueKeysWithValues: httpResponse.allHeaderFields.map {
                (String(describing: $0.key), String(describing: $0.value))
            })
        )
    }

    private static func httpResponse(_ response: URLResponse) throws -> HTTPURLResponse {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw UpdateServiceError.invalidResponse
        }
        return httpResponse
    }

    private static func makeByteStream(
        from asyncBytes: URLSession.AsyncBytes
    ) -> UpdateByteStream {
        UpdateByteStream {
            AsyncThrowingStream { continuation in
                // 迭代器只会被下面这个消费任务访问。
                nonisolated(unsafe) var iterator = asyncBytes.makeAsyncIterator()
                let task = Task {
                    do {
                        while let byte = try await iterator.next() {
                            continuation.yield(byte)
                        }
                        continuation.finish()
                    } catch {
                        continuation.finish(throwing: error)
                    }
                }
                continuation.onTermination = { _ in
                    task.cancel()
                }
            }
        }
    }
}
