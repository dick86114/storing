import Foundation

/// GitHub Release 中可用于 macOS 安装的 DMG 元数据。
public struct AppRelease: Equatable, Identifiable, Sendable {
    public let version: String
    public let tagName: String
    public let releaseNotes: String?
    public let publishedAt: Date?
    public let assetName: String
    public let downloadURL: URL
    public let checksumURL: URL?
    public let sha256: String?

    public var id: String { tagName }

    public init(
        version: String,
        tagName: String,
        releaseNotes: String?,
        publishedAt: Date?,
        assetName: String,
        downloadURL: URL,
        checksumURL: URL?,
        sha256: String?
    ) {
        self.version = version
        self.tagName = tagName
        self.releaseNotes = releaseNotes
        self.publishedAt = publishedAt
        self.assetName = assetName
        self.downloadURL = downloadURL
        self.checksumURL = checksumURL
        self.sha256 = sha256
    }
}

/// 下载完成后供安装器使用的最小数据集合。
public struct DownloadedUpdate: Equatable, Sendable {
    public let version: String
    public let fileURL: URL
    public let sha256: String

    public init(version: String, fileURL: URL, sha256: String) {
        self.version = version
        self.fileURL = fileURL
        self.sha256 = sha256
    }
}

public enum UpdateServiceError: Equatable, Error, Sendable {
    case invalidRelease
    case updateUnavailable
    case network
    case invalidResponse
    case checksumUnavailable
    case incompleteDownload
    case checksumMismatch
    case installFailed
}
