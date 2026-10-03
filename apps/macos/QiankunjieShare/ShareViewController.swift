import AppKit
import Foundation
import QiankunjieWeChat
import UniformTypeIdentifiers

/// 微信「转发到其他应用」的乾坤戒入口。
///
/// Extension 运行在沙盒里且没有网络权限，只负责把微信导出的文件
/// 原子提交到共享 Inbox；解析、上传图床与入库由主应用完成。
@objc(ShareViewController)
final class ShareViewController: NSViewController {
    private var hasStarted = false

    override func loadView() {
        // ShareKit 要求存在视图控制器；这里只做接收，不显示任何界面。
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 1, height: 1))
        view.alphaValue = 0
        self.view = view
        preferredContentSize = .zero
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard !hasStarted, let context = extensionContext else { return }
        hasStarted = true
        let providers = Self.providers(from: context.inputItems)
        Task { @MainActor in
            await Self.run(providers: providers, context: context)
        }
    }

    @MainActor
    private static func run(providers: [NSItemProvider], context: NSExtensionContext) async {
        guard !providers.isEmpty else {
            fail(message: "微信没有传出任何文件", context: context)
            return
        }

        let inbox = WeChatInbox.standard()
        let staging: WeChatBatchStaging
        do {
            staging = try inbox.createBatch()
        } catch {
            fail(message: "无法创建乾坤戒转发收件箱", context: context)
            return
        }

        var items: [WeChatBatchManifest.Item] = []
        do {
            for (index, provider) in providers.enumerated() {
                let item = try await importAttachment(provider, index: index, into: staging)
                items.append(item)
            }
            let manifest = WeChatBatchManifest(batchID: staging.batchID, items: items)
            _ = try staging.commit(manifest: manifest)
        } catch {
            staging.discard()
            fail(message: "保存微信转发文件失败：\(error.localizedDescription)", context: context)
            return
        }

        inbox.pruneStaging()
        launchContainingApp()
        context.completeRequest(returningItems: nil, completionHandler: nil)
    }

    /// 系统提供的临时文件在回调返回后即被删除，复制必须发生在回调内。
    private static func importAttachment(
        _ provider: NSItemProvider,
        index: Int,
        into staging: WeChatBatchStaging
    ) async throws -> WeChatBatchManifest.Item {
        let typeIdentifier = provider.registeredTypeIdentifiers.first { identifier in
            identifier == UTType.data.identifier || identifier == UTType.fileURL.identifier
        } ?? provider.registeredTypeIdentifiers.first { identifier in
            identifier == UTType.utf8PlainText.identifier
                || identifier == UTType.plainText.identifier
                || identifier == UTType.text.identifier
        } ?? provider.registeredTypeIdentifiers.first

        guard let typeIdentifier else {
            throw ImportError.unsupported
        }

        let data: Data
        let filename: String
        if typeIdentifier == UTType.fileURL.identifier {
            let url = try await loadFileURL(provider, typeIdentifier: typeIdentifier)
            data = try Data(contentsOf: url)
            filename = url.lastPathComponent
        } else if typeIdentifier == UTType.utf8PlainText.identifier
            || typeIdentifier == UTType.plainText.identifier
            || typeIdentifier == UTType.text.identifier {
            let text = try await loadTextRepresentation(provider, typeIdentifier: typeIdentifier)
            data = Data(text.utf8)
            filename = index == 0 ? "分享文本.txt" : "分享文本-\(index + 1).txt"
        } else {
            (data, filename) = try await loadFileRepresentation(
                provider,
                typeIdentifier: typeIdentifier
            )
        }
        try staging.write(data: data, filename: filename)

        return WeChatBatchManifest.Item(filename: filename, byteCount: Int64(data.count))
    }

    private static func loadFileRepresentation(
        _ provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> (Data, String) {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { temporaryURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let temporaryURL else {
                    continuation.resume(throwing: ImportError.emptyFile)
                    return
                }
                do {
                    let data = try Data(contentsOf: temporaryURL)
                    let filename = temporaryURL.lastPathComponent
                    continuation.resume(returning: (data, filename))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private static func loadTextRepresentation(
        _ provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: typeIdentifier) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if let string = item as? String {
                    continuation.resume(returning: string)
                    return
                }
                if let data = item as? Data, let string = String(data: data, encoding: .utf8) {
                    continuation.resume(returning: string)
                    return
                }
                if let url = item as? URL, let string = try? String(contentsOf: url, encoding: .utf8) {
                    continuation.resume(returning: string)
                    return
                }
                continuation.resume(throwing: ImportError.emptyFile)
            }
        }
    }

    private static func loadFileURL(
        _ provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            _ = provider.loadObject(ofClass: NSURL.self, completionHandler: { object, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let url = object as? URL else {
                    continuation.resume(throwing: ImportError.emptyFile)
                    return
                }
                continuation.resume(returning: url)
            })
        }
    }

    private static func providers(from inputItems: [Any]) -> [NSItemProvider] {
        inputItems.compactMap { $0 as? NSExtensionItem }.flatMap { $0.attachments ?? [] }
    }

    /// 唤起主应用是尽力而为：即使被系统拒绝，批次也已提交，
    /// 主应用下次启动时会补扫 Inbox。
    private static func launchContainingApp() {
        guard let appURL = containingAppURL else { return }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.addsToRecentItems = false
        NSWorkspace.shared.openApplication(at: appURL, configuration: configuration)
    }

    private static var containingAppURL: URL? {
        let url = Bundle.main.bundleURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return url.pathExtension == "app" ? url : nil
    }

    @MainActor
    private static func fail(message: String, context: NSExtensionContext) {
        context.cancelRequest(
            withError: NSError(
                domain: "com.idickies.storing.share",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        )
    }

    enum ImportError: LocalizedError {
        case unsupported
        case emptyFile

        var errorDescription: String? {
            switch self {
            case .unsupported: "微信传出的文件类型不受支持"
            case .emptyFile: "微信没有返回文件内容"
            }
        }
    }
}
