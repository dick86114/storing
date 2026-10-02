import Foundation
import Testing

@testable import QiankunjieWeChat

struct WeChatInboxTests {
    private func makeTemporaryInbox() throws -> WeChatInbox {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("qiankunjie-inbox-\(UUID().uuidString)", isDirectory: true)
        return WeChatInbox(root: root)
    }

    @Test("批次先写入 Staging，manifest 提交后才在 Ready 可见")
    func commitMakesBatchVisibleAtomically() throws {
        let inbox = try makeTemporaryInbox()
        defer { try? FileManager.default.removeItem(at: inbox.root) }

        let staging = try inbox.createBatch()
        try staging.write(data: Data("PK".utf8), filename: "聊天记录.zip")

        #expect(inbox.readyBatchDirectories().isEmpty)

        let ready = try staging.commit(
            manifest: WeChatBatchManifest(
                batchID: staging.batchID,
                items: [WeChatBatchManifest.Item(filename: "聊天记录.zip", byteCount: 2)]
            )
        )

        // contentsOfDirectory 会把 /var 规范化为 /private/var；
        // 用批次 UUID 比较以避开系统符号链接的两种表示。
        #expect(inbox.readyBatchDirectories().map(\.lastPathComponent) == [ready.lastPathComponent])
        #expect(inbox.batchManifest(at: ready)?.items.first?.filename == "聊天记录.zip")
        #expect(!FileManager.default.fileExists(atPath: staging.directory.path))
    }

    @Test("manifest 使用 ISO8601 时间并保持文件名")
    func manifestRoundTrip() throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let manifest = WeChatBatchManifest(
            batchID: UUID(),
            createdAt: date,
            items: [WeChatBatchManifest.Item(filename: "video.mp4", byteCount: 123)]
        )

        let decoded = try WeChatBatchManifest.decode(manifest.encoded())
        #expect(decoded == manifest)
    }

    @Test("超时的 Staging 残留会被清理")
    func pruneRemovesStaleStaging() throws {
        let inbox = try makeTemporaryInbox()
        defer { try? FileManager.default.removeItem(at: inbox.root) }

        let stale = try inbox.createBatch()
        try stale.write(data: Data("x".utf8), filename: "a.txt")
        let old = Date(timeIntervalSinceNow: -3_600)
        try FileManager.default.setAttributes([.modificationDate: old], ofItemAtPath: stale.directory.path)
        try FileManager.default.setAttributes(
            [.modificationDate: old],
            ofItemAtPath: stale.directory.appendingPathComponent("a.txt").path
        )

        let fresh = try inbox.createBatch()

        let removed = inbox.pruneStaging(olderThan: 1_800, now: Date())
        #expect(removed == 1)
        #expect(!FileManager.default.fileExists(atPath: stale.directory.path))
        #expect(FileManager.default.fileExists(atPath: fresh.directory.path))
    }

    @Test("危险文件名会被替换为安全名称")
    func sanitizesFilenames() {
        #expect(WeChatBatchStaging.safeFilename("../../聊天记录.txt") != "../../聊天记录.txt")
        #expect(WeChatBatchStaging.safeFilename("a/b\\c.zip") == "a_b_c.zip")
        #expect(WeChatBatchStaging.safeFilename("   ") == "file")
    }
}
