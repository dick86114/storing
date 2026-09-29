import CryptoKit
import Foundation

public actor GitHubUpdateService: UpdateChecking, UpdateDownloading {
    private static let releasesURL = URL(
        string: "https://api.github.com/repos/dick86114/storing/releases?per_page=100"
    )!
    private static let atomURL = URL(string: "https://github.com/dick86114/storing/releases.atom")!

    private let currentVersion: String
    private let network: any UpdateNetworkClient
    private let mirrorBaseProvider: @Sendable () async -> String?
    private let cacheDirectory: URL
    private let retryDelay: Duration
    private let maxDownloadAttempts = 3

    public init(
        currentVersion: String,
        network: any UpdateNetworkClient = URLSessionUpdateNetworkClient(),
        mirrorBaseProvider: (@Sendable () async -> String?)? = nil,
        cacheDirectory: URL? = nil,
        retryDelay: Duration = .seconds(1)
    ) {
        self.currentVersion = currentVersion
        self.network = network
        self.mirrorBaseProvider = mirrorBaseProvider ?? { nil }
        self.cacheDirectory = cacheDirectory ?? FileManager.default.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("QiankunjieUpdates", isDirectory: true)
        self.retryDelay = retryDelay
    }

    static func fixture(
        currentVersion: String,
        network: any UpdateNetworkClient,
        mirrorBase: String? = nil,
        cacheDirectory: URL? = nil,
        retryDelay: Duration = .seconds(1)
    ) -> GitHubUpdateService {
        GitHubUpdateService(
            currentVersion: currentVersion,
            network: network,
            mirrorBaseProvider: { mirrorBase },
            cacheDirectory: cacheDirectory,
            retryDelay: retryDelay
        )
    }

    public func checkForUpdate() async throws -> AppRelease? {
        let apiReleases = try? await fetchAPIReleases()
        if let apiReleases {
            return Self.newestRelease(from: apiReleases, newerThan: currentVersion)
        }
        return try await fetchAtomRelease()
    }

    public func download(
        _ release: AppRelease,
        progress: @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate {
        guard Self.compareSemanticVersions(release.version, currentVersion) == .orderedDescending else {
            throw UpdateServiceError.updateUnavailable
        }

        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        let expectedChecksum = try await expectedChecksum(for: release)
        let partialURL = cacheDirectory.appendingPathComponent("\(release.assetName).part")
        let finalURL = cacheDirectory.appendingPathComponent(release.assetName)
        let mirror = await mirrorBaseProvider()

        for attempt in 1...maxDownloadAttempts {
            do {
                let checksum = try await performDownload(
                    release,
                    partialURL: partialURL,
                    expectedChecksum: expectedChecksum,
                    mirror: mirror,
                    progress: progress
                )
                try? FileManager.default.removeItem(at: finalURL)
                try FileManager.default.moveItem(at: partialURL, to: finalURL)
                return DownloadedUpdate(
                    version: release.version,
                    fileURL: finalURL,
                    sha256: checksum
                )
            } catch let error as URLError
            where attempt < maxDownloadAttempts && Self.isRetryableTimeout(error) {
                try? await Task.sleep(for: retryDelay)
                continue
            } catch {
                if case UpdateServiceError.checksumMismatch = error {
                    try? FileManager.default.removeItem(at: partialURL)
                }
                throw error
            }
        }

        throw UpdateServiceError.network
    }

    private func fetchAPIReleases() async throws -> [AppRelease] {
        var request = URLRequest(url: Self.releasesURL)
        request.timeoutInterval = 30
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("Qiankunjie-macOS-updater", forHTTPHeaderField: "User-Agent")
        let response = try await network.data(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw UpdateServiceError.invalidResponse
        }

        struct GitHubRelease: Decodable {
            struct Asset: Decodable {
                let name: String
                let browserDownloadURL: URL

                enum CodingKeys: String, CodingKey {
                    case name
                    case browserDownloadURL = "browser_download_url"
                }
            }

            let tagName: String
            let body: String?
            let publishedAt: String?
            let assets: [Asset]

            enum CodingKeys: String, CodingKey {
                case tagName = "tag_name"
                case body
                case publishedAt = "published_at"
                case assets
            }
        }

        let payloads = try JSONDecoder().decode([GitHubRelease].self, from: response.data)
        return payloads.compactMap { payload in
            guard
                let version = Self.version(fromTag: payload.tagName),
                let asset = payload.assets.first(where: { Self.isDMGName($0.name) })
            else {
                return nil
            }

            let checksumAsset = payload.assets.first { $0.name == "\(asset.name).sha256" }
            return AppRelease(
                version: version,
                tagName: payload.tagName,
                releaseNotes: payload.body,
                publishedAt: Self.parseDate(payload.publishedAt),
                assetName: asset.name,
                downloadURL: asset.browserDownloadURL,
                checksumURL: checksumAsset?.browserDownloadURL
                    ?? asset.browserDownloadURL.appendingPathExtension("sha256"),
                sha256: nil
            )
        }
    }

    private func fetchAtomRelease() async throws -> AppRelease? {
        var request = URLRequest(url: Self.atomURL)
        request.timeoutInterval = 30
        request.setValue("application/atom+xml", forHTTPHeaderField: "Accept")
        request.setValue("Qiankunjie-macOS-updater", forHTTPHeaderField: "User-Agent")
        let response = try await network.data(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw UpdateServiceError.invalidResponse
        }

        let entries = AtomFeedParser().parse(response.data)
        let releases = entries.compactMap { entry -> AppRelease? in
            guard
                let tag = Self.tagName(inAtomEntryID: entry.id, title: entry.title),
                let version = Self.version(fromTag: tag),
                let assetName = Self.dmgName(inText: entry.content)
            else {
                return nil
            }

            let downloadURL = URL(
                string: "https://github.com/dick86114/storing/releases/download/\(tag)/\(assetName)"
            )!
            return AppRelease(
                version: version,
                tagName: tag,
                releaseNotes: entry.title,
                publishedAt: Self.parseDate(entry.updated),
                assetName: assetName,
                downloadURL: downloadURL,
                checksumURL: downloadURL.appendingPathExtension("sha256"),
                sha256: nil
            )
        }
        return Self.newestRelease(from: releases, newerThan: currentVersion)
    }

    private func performDownload(
        _ release: AppRelease,
        partialURL: URL,
        expectedChecksum: String,
        mirror: String?,
        progress: @Sendable (Double?) -> Void
    ) async throws -> String {
        let resumeOffset = (try? FileManager.default.attributesOfItem(
            atPath: partialURL.path
        )[.size] as? Int64) ?? 0
        var request = URLRequest(url: Self.applyMirror(release.downloadURL, mirror: mirror))
        request.timeoutInterval = 60
        request.setValue("Qiankunjie-macOS-updater", forHTTPHeaderField: "User-Agent")
        if resumeOffset > 0 {
            request.setValue("bytes=\(resumeOffset)-", forHTTPHeaderField: "Range")
        }

        let response = try await network.stream(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw UpdateServiceError.invalidResponse
        }

        let normalizedHeaders = Dictionary(uniqueKeysWithValues: response.headers.map {
            ($0.key.lowercased(), $0.value)
        })
        let acceptedContentRange: (start: Int64, total: Int64?)?
        if response.statusCode == 206, resumeOffset > 0 {
            acceptedContentRange = normalizedHeaders["content-range"].flatMap(Self.contentRange)
        } else {
            acceptedContentRange = nil
        }
        let canResume = acceptedContentRange?.start == resumeOffset
        if response.statusCode == 206, resumeOffset > 0, !canResume {
            FileManager.default.createFile(atPath: partialURL.path, contents: nil)
            return try await performDownload(
                release,
                partialURL: partialURL,
                expectedChecksum: expectedChecksum,
                mirror: mirror,
                progress: progress
            )
        }
        let startOffset = canResume ? resumeOffset : 0
        if !canResume {
            FileManager.default.createFile(atPath: partialURL.path, contents: nil)
        }
        let fileHandle = try FileHandle(forWritingTo: partialURL)
        if canResume {
            try fileHandle.seekToEnd()
        }
        defer { try? fileHandle.close() }

        let total: Int64?
        if canResume {
            total = acceptedContentRange?.total
        } else {
            total = normalizedHeaders["content-length"].flatMap(Int64.init)
        }
        var hasher = SHA256()
        var received = Int64(0)
        var writeBuffer = Data()
        let writeBufferSize = 1 << 20
        if canResume, let existingData = try? Data(contentsOf: partialURL) {
            hasher.update(data: existingData)
        }
        let reportedTotal: Int64?
        if let total, total > 0 {
            reportedTotal = total
        } else {
            reportedTotal = nil
        }
        progress(reportedTotal.map { Double(startOffset) / Double($0) })

        for try await byte in response.bytes {
            received += 1
            writeBuffer.append(byte)
            if writeBuffer.count >= writeBufferSize {
                hasher.update(data: writeBuffer)
                try fileHandle.write(contentsOf: writeBuffer)
                writeBuffer.removeAll(keepingCapacity: true)
            }
            if let reportedTotal {
                progress(min(1, Double(startOffset + received) / Double(reportedTotal)))
            }
        }
        if !writeBuffer.isEmpty {
            hasher.update(data: writeBuffer)
            try fileHandle.write(contentsOf: writeBuffer)
        }

        if let reportedTotal, startOffset + received != reportedTotal {
            throw UpdateServiceError.incompleteDownload
        }

        let actualChecksum = SHA256HexCalculator.hex(hasher.finalize()).lowercased()
        guard actualChecksum == expectedChecksum.lowercased() else {
            throw UpdateServiceError.checksumMismatch
        }
        return actualChecksum
    }

    private func expectedChecksum(for release: AppRelease) async throws -> String {
        if let sha256 = release.sha256 {
            return sha256
        }
        guard let checksumURL = release.checksumURL else {
            throw UpdateServiceError.checksumUnavailable
        }

        let mirror = await mirrorBaseProvider()
        var request = URLRequest(url: Self.applyMirror(checksumURL, mirror: mirror))
        request.timeoutInterval = 30
        request.setValue("Qiankunjie-macOS-updater", forHTTPHeaderField: "User-Agent")
        let response = try await network.data(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw UpdateServiceError.checksumUnavailable
        }
        guard let checksum = Self.checksum(in: String(data: response.data, encoding: .utf8) ?? "") else {
            throw UpdateServiceError.checksumUnavailable
        }
        return checksum
    }

    private static func newestRelease(
        from releases: [AppRelease],
        newerThan currentVersion: String
    ) -> AppRelease? {
        releases
            .filter { compareSemanticVersions($0.version, currentVersion) == .orderedDescending }
            .max { compareSemanticVersions($0.version, $1.version) == .orderedAscending }
    }

    private static func compareSemanticVersions(_ left: String, _ right: String) -> ComparisonResult {
        let leftParts = left.split(separator: ".").compactMap { Int($0) }
        let rightParts = right.split(separator: ".").compactMap { Int($0) }
        for index in 0..<max(leftParts.count, rightParts.count) {
            let leftValue = index < leftParts.count ? leftParts[index] : 0
            let rightValue = index < rightParts.count ? rightParts[index] : 0
            if leftValue < rightValue { return .orderedAscending }
            if leftValue > rightValue { return .orderedDescending }
        }
        return .orderedSame
    }

    private static func version(fromTag tag: String) -> String? {
        guard let match = tag.firstMatch(of: /^macos-v([0-9]+)\.([0-9]+)\.([0-9]+)$/) else {
            return nil
        }
        return "\(match.1).\(match.2).\(match.3)"
    }

    private static func tagName(inAtomEntryID id: String, title: String) -> String? {
        [id, title]
            .lazy
            .compactMap { Self.stableTagName(inText: $0) }
            .first
    }

    private static func stableTagName(inText text: String) -> String? {
        text
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "." && $0 != "-" && $0 != "_" })
            .first { $0.firstMatch(of: /^macos-v([0-9]+)\.([0-9]+)\.([0-9]+)$/) != nil }
            .map(String.init)
    }

    private static func isDMGName(_ name: String) -> Bool {
        name.lowercased().hasSuffix(".dmg")
    }

    private static func dmgName(inText text: String) -> String? {
        text
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "." && $0 != "-" && $0 != "_" })
            .first(where: { isDMGName(String($0)) })
            .map(String.init)
    }

    private static func checksum(in text: String) -> String? {
        text.lowercased().firstMatch(of: /[0-9a-f]{64}/).map { String($0.output) }
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractionalFormatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private static func applyMirror(_ url: URL, mirror: String?) -> URL {
        let trimmedMirror = mirror?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard
            !trimmedMirror.isEmpty,
            let components = URLComponents(string: trimmedMirror),
            components.scheme == "https",
            components.host?.isEmpty == false,
            components.path.isEmpty || components.path == "/"
        else {
            return url
        }

        let prefix = trimmedMirror.hasSuffix("/") ? trimmedMirror : "\(trimmedMirror)/"
        return URL(string: "\(prefix)\(url.absoluteString)") ?? url
    }

    private static func contentRange(_ value: String) -> (start: Int64, total: Int64?)? {
        guard
            let match = value.firstMatch(
                of: /^bytes[ ]+([0-9]+)-([0-9]+)\/([0-9]+)$/
            ),
            let start = Int64(match.1),
            let end = Int64(match.2),
            let total = Int64(match.3),
            start <= end,
            end + 1 == total
        else {
            return nil
        }
        return (start, total)
    }

    private static func isRetryableTimeout(_ error: URLError) -> Bool {
        [
            .timedOut,
            .networkConnectionLost,
            .notConnectedToInternet,
            .cannotConnectToHost,
        ].contains(error.code)
    }
}

enum SHA256HexCalculator {
    static func hex(_ digest: SHA256.Digest) -> String {
        digest.map { String(format: "%02x", $0) }.joined()
    }

    static func hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

struct AtomEntry: Sendable {
    let id: String
    let title: String
    let updated: String?
    let content: String
}

private final class AtomFeedParser: NSObject, XMLParserDelegate, @unchecked Sendable {
    private var entries: [AtomEntry] = []
    private var currentID = ""
    private var currentTitle = ""
    private var currentUpdated: String?
    private var currentContent = ""
    private var currentElement = ""
    private var currentText = ""

    func parse(_ data: Data) -> [AtomEntry] {
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
        return entries
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        currentElement = elementName
        currentText = ""
        if elementName == "entry" {
            currentID = ""
            currentTitle = ""
            currentUpdated = nil
            currentContent = ""
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        guard ["id", "title", "updated", "content"].contains(currentElement) else { return }
        currentText += string
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        defer {
            currentElement = ""
            currentText = ""
        }

        switch elementName {
        case "id":
            currentID = currentText
        case "title":
            currentTitle = currentText
        case "updated":
            currentUpdated = currentText
        case "content":
            currentContent = currentText
        case "entry":
            entries.append(
                AtomEntry(
                    id: currentID,
                    title: currentTitle,
                    updated: currentUpdated,
                    content: currentContent
                )
            )
        default:
            break
        }
    }
}
