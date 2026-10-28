import Foundation
import WebKit

/// 阅读器独立的 WebKit 数据仓库，让远程正文图片可以跨文章切换和重启复用磁盘缓存。
@MainActor
final class ReaderWebCache {
    private static let defaultIdentifier = UUID(
        uuidString: "7A4C15C0-9A89-4E7E-A6E2-BCC12C28D2D7"
    )!

    let identifier: UUID

    init(identifier: UUID = ReaderWebCache.defaultIdentifier) {
        self.identifier = identifier
    }

    var websiteDataStore: WKWebsiteDataStore {
        WKWebsiteDataStore(forIdentifier: identifier)
    }

    /// 只清理阅读器自己的 WebKit 缓存，不触碰应用内其他网页数据。
    func clear() async {
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        await withCheckedContinuation { continuation in
            websiteDataStore.removeData(
                ofTypes: dataTypes,
                modifiedSince: .distantPast
            ) {
                continuation.resume()
            }
        }
    }
}
