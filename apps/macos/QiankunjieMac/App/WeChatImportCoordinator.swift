import Foundation
import Observation
import QiankunjieWeChat

/// 消费微信转发 Inbox：监听新批次、上传服务端、成功后清理并刷新列表。
///
/// 批次上传失败会保留在 Ready 目录，应用下次启动或激活时自动重试；
/// 未登录时同样保留，避免用户内容丢失。
@MainActor
@Observable
final class WeChatImportCoordinator {
    private let inbox: WeChatInbox
    private let repository: WeChatImportRepository
    private var watcher: WeChatInboxWatcher?
    private var isProcessing = false
    private let isAuthenticated: () -> Bool
    private let onImported: (WeChatImportResult) async -> Void

    init(
        inbox: WeChatInbox = .standard(),
        repository: WeChatImportRepository,
        isAuthenticated: @escaping () -> Bool,
        onImported: @escaping (WeChatImportResult) async -> Void
    ) {
        self.inbox = inbox
        self.repository = repository
        self.isAuthenticated = isAuthenticated
        self.onImported = onImported
    }

    func start() {
        guard watcher == nil else { return }
        watcher = WeChatInboxWatcher(inbox: inbox) { [weak self] in
            self?.processPendingBatches()
        }
        watcher?.start()
        processPendingBatches()
    }

    func processPendingBatches() {
        guard !isProcessing, isAuthenticated() else { return }
        isProcessing = true

        Task { [weak self] in
            guard let self else { return }
            defer { self.isProcessing = false }

            for batchDirectory in self.inbox.readyBatchDirectories() {
                guard let manifest = self.inbox.batchManifest(at: batchDirectory) else {
                    // 没有 manifest 的批次不可能完整，按残留清理。
                    self.inbox.removeBatch(at: batchDirectory)
                    continue
                }

                do {
                    // 大文件读取不能留在 MainActor；否则导入期间整个 UI 会卡住。
                    let files = try await readImportFiles(manifest, batchDirectory: batchDirectory)
                    let result = try await self.repository.importFiles(files)
                    self.inbox.removeBatch(at: batchDirectory)
                    await self.onImported(result)
                } catch is CancellationError {
                    break
                } catch {
                    // 单个批次失败保留待重试，继续处理后续批次。
                    continue
                }
            }
        }
    }

    nonisolated private func readImportFiles(
        _ manifest: WeChatBatchManifest,
        batchDirectory: URL
    ) async throws -> [WeChatMultipartBuilder.FilePart] {
        try manifest.items.map { item in
            let url = batchDirectory.appendingPathComponent(item.filename, isDirectory: false)
            return WeChatMultipartBuilder.FilePart(
                filename: item.filename,
                data: try Data(contentsOf: url),
                mimeType: WeChatMultipartBuilder.mimeType(forFilename: item.filename)
            )
        }
    }
}
