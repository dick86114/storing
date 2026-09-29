import Foundation
import Testing
@testable import QiankunjieUpdating

// 可复现网络响应的测试替身，用于覆盖 Release 检查和下载重试。
actor MockUpdateNetwork {
    enum Response {
        case data(statusCode: Int, body: Data)
        case stream(statusCode: Int, headers: [String: String], bytes: [UInt8])
        case failure(URLError)
    }

    private var responses: [Response]
    private(set) var requests: [URLRequest] = []

    init(_ responses: [Response]) {
        self.responses = responses
    }

    func data(for request: URLRequest) async throws -> UpdateDataResponse {
        requests.append(request)
        guard case let .data(statusCode, body) = responses.removeFirst() else {
            fatalError("网络测试配置错误：此处应为普通 HTTP 数据响应")
        }
        return UpdateDataResponse(data: body, statusCode: statusCode, headers: [:])
    }

    func stream(for request: URLRequest) async throws -> UpdateStreamResponse {
        requests.append(request)
        let response = responses.removeFirst()
        switch response {
        case let .stream(statusCode, headers, bytes):
            let continuationStream = AsyncThrowingStream<UInt8, Error> { continuation in
                for byte in bytes {
                    continuation.yield(byte)
                }
                continuation.finish()
            }
            return UpdateStreamResponse(
                bytes: UpdateByteStream { continuationStream },
                statusCode: statusCode,
                headers: headers
            )
        case let .failure(error):
            throw error
        case .data:
            fatalError("网络测试配置错误：此处应为字节流响应")
        }
    }
}

extension MockUpdateNetwork: UpdateNetworkClient {}

extension AppRelease {
    static func fixture(
        tag: String = "macos-v1.3.0",
        version: String? = nil,
        assetName: String = "Qiankunjie-1.3.0-arm64.dmg",
        sha256: String? = String(repeating: "a", count: 64)
    ) -> AppRelease {
        let resolvedVersion = version ?? String(tag.dropFirst("macos-v".count))
        let downloadURL = URL(
            string: "https://github.com/dick86114/storing/releases/download/\(tag)/\(assetName)"
        )!
        return AppRelease(
            version: resolvedVersion,
            tagName: tag,
            releaseNotes: "测试更新",
            publishedAt: nil,
            assetName: assetName,
            downloadURL: downloadURL,
            checksumURL: downloadURL.appendingPathExtension("sha256"),
            sha256: sha256
        )
    }
}

@Test func onlyNewerMacOSReleaseTagsAreSelected() async throws {
    let network = MockUpdateNetwork([
        .data(
            statusCode: 200,
            body: Data("""
            [
              {"tag_name":"browser-extension-v9.9.9","assets":[]},
              {"tag_name":"macos-v1.2.0","assets":[{"name":"Qiankunjie-1.2.0-arm64.dmg","browser_download_url":"https://github.com/dick86114/storing/releases/download/macos-v1.2.0/Qiankunjie-1.2.0-arm64.dmg"}]},
              {"tag_name":"macos-v1.3.0","assets":[{"name":"Qiankunjie-1.3.0-arm64.dmg","browser_download_url":"https://github.com/dick86114/storing/releases/download/macos-v1.3.0/Qiankunjie-1.3.0-arm64.dmg"}]}
            ]
            """.utf8)
        ),
    ])
    let service = GitHubUpdateService.fixture(currentVersion: "1.2.0", network: network)

    let release = try await service.checkForUpdate()

    #expect(release?.version == "1.3.0")
}

@Test func githubAPIFailureFallsBackToAtomFeed() async throws {
    let atom = """
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>tag:github.com,2008:Repository/1/macos-v1.3.0</id>
        <title>乾坤戒 1.3.0</title>
        <content type="html">&lt;code&gt;Qiankunjie-1.3.0-arm64.dmg&lt;/code&gt;</content>
      </entry>
      <entry>
        <id>tag:github.com,2008:Repository/1/browser-extension-v9.9.9</id>
        <title>浏览器扩展</title>
        <content type="html"></content>
      </entry>
    </feed>
    """
    let network = MockUpdateNetwork([
        .data(statusCode: 403, body: Data("{}".utf8)),
        .data(statusCode: 200, body: Data(atom.utf8)),
    ])
    let service = GitHubUpdateService.fixture(currentVersion: "1.2.0", network: network)

    let release = try await service.checkForUpdate()

    #expect(release?.version == "1.3.0")
    #expect(release?.assetName == "Qiankunjie-1.3.0-arm64.dmg")
    #expect(release?.checksumURL?.absoluteString.hasSuffix(".sha256") == true)
}

@Test func prereleaseAndMalformedMacOSReleaseTagsAreRejected() async throws {
    let network = MockUpdateNetwork([
        .data(
            statusCode: 200,
            body: Data("""
            [
              {"tag_name":"macos-v1.4.0-rc.1","assets":[{"name":"rc.dmg","browser_download_url":"https://github.com/dick86114/storing/releases/download/macos-v1.4.0-rc.1/rc.dmg"}]},
              {"tag_name":"macos-v1.4.0-extra","assets":[{"name":"bad.dmg","browser_download_url":"https://github.com/dick86114/storing/releases/download/macos-v1.4.0-extra/bad.dmg"}]},
              {"tag_name":"macos-v1.3.0","assets":[{"name":"Qiankunjie-1.3.0-arm64.dmg","browser_download_url":"https://github.com/dick86114/storing/releases/download/macos-v1.3.0/Qiankunjie-1.3.0-arm64.dmg"}]}
            ]
            """.utf8)
        ),
    ])
    let service = GitHubUpdateService.fixture(currentVersion: "1.2.0", network: network)

    let release = try await service.checkForUpdate()

    #expect(release?.version == "1.3.0")
}

@Test func atomIDsAndTitlesRejectPrereleaseTagsAndAcceptOnlyStableTags() async throws {
    let atom = """
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>tag:github.com,2008:Repository/1/macos-v1.4.0-rc.1</id>
        <title>乾坤戒 macos-v1.4.0-rc.1</title>
        <content type="html">&lt;code&gt;rc.dmg&lt;/code&gt;</content>
      </entry>
      <entry>
        <id>tag:github.com,2008:Repository/1/release-unknown</id>
        <title>乾坤戒 macos-v1.3.0</title>
        <content type="html">&lt;code&gt;Qiankunjie-1.3.0-arm64.dmg&lt;/code&gt;</content>
      </entry>
    </feed>
    """
    let network = MockUpdateNetwork([
        .data(statusCode: 403, body: Data("{}".utf8)),
        .data(statusCode: 200, body: Data(atom.utf8)),
    ])
    let service = GitHubUpdateService.fixture(currentVersion: "1.2.0", network: network)

    let release = try await service.checkForUpdate()

    #expect(release?.version == "1.3.0")
}

@Test func downloadResumesWithRangeAndRetriesAfterTimeout() async throws {
    let payload = Data((0..<64).map { UInt8($0 % 251) })
    let expectedSHA256 = SHA256HexCalculator.hex(payload)
    let cacheDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("qiankunjie-update-resume-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    let partialURL = cacheDirectory.appendingPathComponent("Qiankunjie-1.3.0-arm64.dmg.part")
    try payload.prefix(32).write(to: partialURL)

    let network = MockUpdateNetwork([
        .failure(URLError(.timedOut)),
        .stream(
            statusCode: 206,
            headers: ["Content-Range": "bytes 32-63/64"],
            bytes: Array(payload.suffix(32))
        ),
    ])
    let service = GitHubUpdateService.fixture(
        currentVersion: "1.2.0",
        network: network,
        mirrorBase: "https://ghfast.top",
        cacheDirectory: cacheDirectory,
        retryDelay: .zero
    )

    let update = try await service.download(.fixture(sha256: expectedSHA256)) { _ in }
    let downloadedData = try Data(contentsOf: update.fileURL)

    #expect(update.sha256 == expectedSHA256)
    #expect(downloadedData == payload)
    let requests = await network.requests
    #expect(requests.count == 2)
    #expect(requests[0].url?.absoluteString == "https://ghfast.top/https://github.com/dick86114/storing/releases/download/macos-v1.3.0/Qiankunjie-1.3.0-arm64.dmg")
    #expect(requests[1].value(forHTTPHeaderField: "Range") == "bytes=32-")
    try? FileManager.default.removeItem(at: cacheDirectory)
}

@Test func tamperedDownloadNeverProducesInstallableFile() async throws {
    let payload = Data((0..<48).map { UInt8($0) })
    let cacheDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent("qiankunjie-update-tamper-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    let network = MockUpdateNetwork([
        .stream(statusCode: 200, headers: ["Content-Length": "48"], bytes: Array(payload)),
    ])
    let service = GitHubUpdateService.fixture(
        currentVersion: "1.2.0",
        network: network,
        cacheDirectory: cacheDirectory,
        retryDelay: .zero
    )

    await #expect(throws: UpdateServiceError.checksumMismatch) {
        _ = try await service.download(.fixture()) { _ in }
    }

    let finalURL = cacheDirectory.appendingPathComponent("Qiankunjie-1.3.0-arm64.dmg")
    let partialURL = cacheDirectory.appendingPathComponent("Qiankunjie-1.3.0-arm64.dmg.part")
    #expect(FileManager.default.fileExists(atPath: finalURL.path) == false)
    #expect(FileManager.default.fileExists(atPath: partialURL.path) == false)
    try? FileManager.default.removeItem(at: cacheDirectory)
}

@Test func invalidOrMissingContentRangeRestartsFromByteZero() async throws {
    let payload = Data((0..<64).map { UInt8(($0 + 17) % 251) })
    let expectedSHA256 = SHA256HexCalculator.hex(payload)
    let headerCases: [[String: String]] = [
        ["Content-Range": "bytes 8-63/64"],
        ["Content-Range": "not-a-content-range"],
        [:],
    ]

    for headers in headerCases {
        let cacheDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("qiankunjie-invalid-range-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        try payload.prefix(32).write(
            to: cacheDirectory.appendingPathComponent("Qiankunjie-1.3.0-arm64.dmg.part")
        )
        let network = MockUpdateNetwork([
            .stream(statusCode: 206, headers: headers, bytes: Array(payload.suffix(32))),
            .stream(statusCode: 200, headers: ["Content-Length": "64"], bytes: Array(payload)),
        ])
        let service = GitHubUpdateService.fixture(
            currentVersion: "1.2.0",
            network: network,
            cacheDirectory: cacheDirectory,
            retryDelay: .zero
        )

        let update = try await service.download(.fixture(sha256: expectedSHA256)) { _ in }

        #expect(try Data(contentsOf: update.fileURL) == payload)
        let requests = await network.requests
        #expect(requests.count == 2)
        #expect(requests[0].value(forHTTPHeaderField: "Range") == "bytes=32-")
        #expect(requests[1].value(forHTTPHeaderField: "Range") == nil)
        try? FileManager.default.removeItem(at: cacheDirectory)
    }
}
