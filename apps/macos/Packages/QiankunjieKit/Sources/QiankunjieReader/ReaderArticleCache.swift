import Foundation
import QiankunjieCore

public struct ReaderArticleCacheStatistics: Equatable, Sendable {
    public let articleCount: Int
    public let totalBytes: Int64

    public init(articleCount: Int, totalBytes: Int64) {
        self.articleCount = articleCount
        self.totalBytes = totalBytes
    }

    public static let empty = ReaderArticleCacheStatistics(
        articleCount: 0,
        totalBytes: 0
    )
}

public protocol ReaderArticleCaching: Sendable {
    func load(
        selection: ReaderSelection,
        userID: Int?
    ) async throws -> ArticleDetail?
    func save(
        _ detail: ArticleDetail,
        selection: ReaderSelection,
        userID: Int?
    ) async throws
    func remove(
        selection: ReaderSelection,
        userID: Int?
    ) async throws
    func clear() async throws
    func statistics() async throws -> ReaderArticleCacheStatistics
}

public struct EmptyReaderArticleCache: ReaderArticleCaching, Sendable {
    public init() {}

    public func load(
        selection: ReaderSelection,
        userID: Int?
    ) async throws -> ArticleDetail? {
        nil
    }

    public func save(
        _ detail: ArticleDetail,
        selection: ReaderSelection,
        userID: Int?
    ) async throws {}

    public func remove(
        selection: ReaderSelection,
        userID: Int?
    ) async throws {}

    public func clear() async throws {}

    public func statistics() async throws -> ReaderArticleCacheStatistics {
        .empty
    }
}

/// 将完整文章详情按账号和文章拆分落盘；读取时刷新访问时间，用于容量淘汰。
public actor ReaderArticleCache: ReaderArticleCaching {
    public static let defaultMaximumDiskSize: Int64 = 256 * 1024 * 1024
    public static let defaultMaximumAge: TimeInterval = 60 * 24 * 60 * 60

    private let directoryURL: URL
    private let maximumDiskSize: Int64
    private let maximumAge: TimeInterval
    private let fileManager: FileManager

    public init(
        directoryURL: URL? = nil,
        maximumDiskSize: Int64 = ReaderArticleCache.defaultMaximumDiskSize,
        maximumAge: TimeInterval = ReaderArticleCache.defaultMaximumAge,
        fileManager: FileManager = .default
    ) {
        self.directoryURL = directoryURL ?? Self.defaultDirectory(fileManager: fileManager)
        self.maximumDiskSize = max(0, maximumDiskSize)
        self.maximumAge = max(0, maximumAge)
        self.fileManager = fileManager
    }

    public func load(
        selection: ReaderSelection,
        userID: Int?
    ) async throws -> ArticleDetail? {
        let fileURL = cacheFileURL(selection: selection, userID: userID)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        let values = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey])
        if
            maximumAge > 0,
            let modifiedAt = values?.contentModificationDate,
            Date().timeIntervalSince(modifiedAt) > maximumAge
        {
            try? fileManager.removeItem(at: fileURL)
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let detail = try JSONDecoder.qiankunjie.decode(ArticleDetail.self, from: data)
            try? fileManager.setAttributes(
                [.modificationDate: Date()],
                ofItemAtPath: fileURL.path
            )
            return detail
        } catch {
            try? fileManager.removeItem(at: fileURL)
            return nil
        }
    }

    public func save(
        _ detail: ArticleDetail,
        selection: ReaderSelection,
        userID: Int?
    ) async throws {
        try ensureDirectoryExists()
        let data = try JSONEncoder.qiankunjie.encode(detail)
        try data.write(
            to: cacheFileURL(selection: selection, userID: userID),
            options: .atomic
        )
        try trimIfNeeded()
    }

    public func remove(
        selection: ReaderSelection,
        userID: Int?
    ) async throws {
        let fileURL = cacheFileURL(selection: selection, userID: userID)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return
        }
        try fileManager.removeItem(at: fileURL)
    }

    public func clear() async throws {
        guard fileManager.fileExists(atPath: directoryURL.path) else {
            return
        }
        let files = try cacheFiles()
        for file in files {
            try? fileManager.removeItem(at: file.url)
        }
    }

    public func statistics() async throws -> ReaderArticleCacheStatistics {
        guard fileManager.fileExists(atPath: directoryURL.path) else {
            return .empty
        }
        try trimIfNeeded()
        let files = try cacheFiles()
        return ReaderArticleCacheStatistics(
            articleCount: files.count,
            totalBytes: files.reduce(0) { $0 + $1.byteCount }
        )
    }

    private func cacheFileURL(
        selection: ReaderSelection,
        userID: Int?
    ) -> URL {
        let scope = selection.isGuest
            ? "guest"
            : "user-\(userID.map(String.init) ?? "anonymous")"
        return directoryURL.appendingPathComponent(
            "v1-\(scope)-article-\(selection.articleID).json"
        )
    }

    private func ensureDirectoryExists() throws {
        try fileManager.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
    }

    private func cacheFiles() throws -> [CacheFile] {
        let urls = try fileManager.contentsOfDirectory(
            at: directoryURL,
            includingPropertiesForKeys: [
                .contentModificationDateKey,
                .fileSizeKey,
                .isRegularFileKey,
            ],
            options: [.skipsHiddenFiles]
        )

        return urls.compactMap { url in
            guard url.pathExtension == "json" else {
                return nil
            }
            guard let values = try? url.resourceValues(
                forKeys: [
                    .contentModificationDateKey,
                    .fileSizeKey,
                    .isRegularFileKey,
                ]
            ) else {
                return nil
            }
            guard values.isRegularFile == true else {
                return nil
            }
            return CacheFile(
                url: url,
                byteCount: Int64(values.fileSize ?? 0),
                modifiedAt: values.contentModificationDate ?? .distantPast
            )
        }
    }

    private func trimIfNeeded() throws {
        var files = try cacheFiles()
        let expirationDate = Date().addingTimeInterval(-maximumAge)

        if maximumAge > 0 {
            let expired = files.filter { $0.modifiedAt < expirationDate }
            for file in expired {
                try? fileManager.removeItem(at: file.url)
            }
            files.removeAll { $0.modifiedAt < expirationDate }
        }

        var totalBytes = files.reduce(0) { $0 + $1.byteCount }
        guard totalBytes > maximumDiskSize else {
            return
        }

        for file in files.sorted(by: { $0.modifiedAt < $1.modifiedAt }) {
            guard totalBytes > maximumDiskSize else {
                break
            }
            try? fileManager.removeItem(at: file.url)
            totalBytes -= file.byteCount
        }
    }

    private static func defaultDirectory(
        fileManager: FileManager
    ) -> URL {
        let caches = fileManager.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        ).first ?? fileManager.temporaryDirectory
        return caches
            .appendingPathComponent("Storing", isDirectory: true)
            .appendingPathComponent("ReaderArticles", isDirectory: true)
    }
}

private struct CacheFile {
    let url: URL
    let byteCount: Int64
    let modifiedAt: Date
}
