import Foundation

/// 控制阅读器内可以出现的地址；服务端 HTML 通过本地字符串加载。
public enum ReaderNavigationDecision: Equatable, Sendable {
    case load
    case openExternally
    case block
}

public enum ReaderNavigationPolicy {
    public static func decision(for url: URL) -> ReaderNavigationDecision {
        guard let scheme = url.scheme?.lowercased() else {
            return .block
        }

        // 文章正文中的外部地址一律离开阅读器，避免 WKWebView 形成第二套浏览入口。
        if scheme == "http" || scheme == "https" {
            return .openExternally
        }

        return .block
    }
}
