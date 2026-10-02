import Foundation

/// 微信转发文件的共享收件箱。
///
/// 采用 WeChatBridge 验证过的目录模型：
///
/// ```text
/// <root>/Staging/<batch-id>.partial/   ← 只有 Extension 写入
/// <root>/Ready/<batch-id>/             ← 原子提交后主应用消费
/// ```
///
/// 批次通过一次 `rename(2)` 变为可见，中断只会留下 Staging 残留，
/// 不会让主应用读到半成品。共享目录模式避开无 Team ID 构建下
/// App Group 容器的 TCC 提示，Developer ID 与本地开发都可用。
public struct WeChatInbox: Sendable {
    public let root: URL

    public init(root: URL) {
        self.root = root
    }

    /// 使用真实用户主目录。沙盒 Extension 中 `NSHomeDirectory()` 指向容器，
    /// 因此必须读取 passwd 条目。
    public static func standard() -> WeChatInbox {
        let home: String
        if let entry = getpwuid(getuid()), let path = entry.pointee.pw_dir {
            home = String(cString: path)
        } else {
            home = NSHomeDirectory()
        }
        return WeChatInbox(
            root: URL(fileURLWithPath: home, isDirectory: true)
                .appendingPathComponent("Library/Application Support/Storing/WeChatInbox", isDirectory: true)
        )
    }

    public var staging: URL { root.appendingPathComponent("Staging", isDirectory: true) }
    public var ready: URL { root.appendingPathComponent("Ready", isDirectory: true) }

    public func prepareDirectories(fileManager: FileManager = .default) throws {
        try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: ready, withIntermediateDirectories: true)
    }

    /// 创建一个尚未可见的批次目录。
    public func createBatch(fileManager: FileManager = .default) throws -> WeChatBatchStaging {
        try prepareDirectories(fileManager: fileManager)
        let batchID = UUID()
        let directory = staging.appendingPathComponent("\(batchID.uuidString).partial", isDirectory: true)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return WeChatBatchStaging(batchID: batchID, inbox: self)
    }

    public func readyBatchDirectories(fileManager: FileManager = .default) -> [URL] {
        (try? fileManager.contentsOfDirectory(
            at: ready,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ))?
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true }
            .sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []
    }

    public func batchManifest(at batchDirectory: URL) -> WeChatBatchManifest? {
        let url = batchDirectory.appendingPathComponent(WeChatBatchManifest.filename)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? WeChatBatchManifest.decode(data)
    }

    public func removeBatch(at batchDirectory: URL, fileManager: FileManager = .default) {
        try? fileManager.removeItem(at: batchDirectory)
    }

    /// 清理超时的 Staging 残留。以目录树中最新的修改时间为准，
    /// 正在写入的大文件不会因为父目录时间旧而被误删。
    @discardableResult
    public func pruneStaging(
        olderThan interval: TimeInterval = 30 * 60,
        now: Date = Date(),
        fileManager: FileManager = .default
    ) -> Int {
        let contents = (try? fileManager.contentsOfDirectory(
            at: staging,
            includingPropertiesForKeys: [.contentModificationDateKey, .isDirectoryKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        var removed = 0
        for candidate in contents {
            let newest = newestModificationDate(at: candidate, fileManager: fileManager) ?? .distantPast
            guard now.timeIntervalSince(newest) > interval else { continue }
            if (try? fileManager.removeItem(at: candidate)) != nil {
                removed += 1
            }
        }
        return removed
    }

    private func newestModificationDate(at url: URL, fileManager: FileManager) -> Date? {
        let keys: Set<URLResourceKey> = [.contentModificationDateKey]
        var newest = (try? url.resourceValues(forKeys: keys))?.contentModificationDate
        guard let enumerator = fileManager.enumerator(
            at: url,
            includingPropertiesForKeys: Array(keys),
            options: [.skipsHiddenFiles]
        ) else { return newest }

        for case let child as URL in enumerator {
            guard let date = (try? child.resourceValues(forKeys: keys))?.contentModificationDate else { continue }
            if newest == nil || date > newest! {
                newest = date
            }
        }
        return newest
    }
}

/// Extension 侧的批次写入器：先在 Staging 落盘，manifest 齐全后一次 rename 提交。
public struct WeChatBatchStaging {
    public let batchID: UUID
    private let inbox: WeChatInbox

    var directory: URL {
        inbox.staging.appendingPathComponent("\(batchID.uuidString).partial", isDirectory: true)
    }

    init(batchID: UUID, inbox: WeChatInbox) {
        self.batchID = batchID
        self.inbox = inbox
    }

    public func write(data: Data, filename: String) throws {
        let sanitized = Self.safeFilename(filename)
        let destination = directory.appendingPathComponent(sanitized, isDirectory: false)
        try data.write(to: destination, options: [.atomic])
    }

    /// 提交批次。manifest 是最后写入的文件，rename 后主应用才能看到整批内容。
    public func commit(manifest: WeChatBatchManifest, fileManager: FileManager = .default) throws -> URL {
        let manifestData = try manifest.encoded()
        try manifestData.write(
            to: directory.appendingPathComponent(WeChatBatchManifest.filename, isDirectory: false),
            options: [.atomic]
        )
        let destination = inbox.ready.appendingPathComponent(batchID.uuidString, isDirectory: true)
        try fileManager.moveItem(at: directory, to: destination)
        return destination
    }

    public func discard(fileManager: FileManager = .default) {
        try? fileManager.removeItem(at: directory)
    }

    /// 只保留安全文件名，避免微信侧名称把路径分隔符等内容带进批次目录。
    static func safeFilename(_ raw: String) -> String {
        let forbidden = CharacterSet(charactersIn: "/\\:?%*|\"<>")
            .union(.newlines)
            .union(.controlCharacters)
        let cleaned = raw.components(separatedBy: forbidden).joined(separator: "_")
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "file" : trimmed
    }
}
