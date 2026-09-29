import Foundation
import Testing
@testable import QiankunjieReader

@Suite("阅读器导航策略")
struct ReaderNavigationPolicyTests {
    @Test func 文件和自定义协议导航会被阻止() {
        #expect(ReaderNavigationPolicy.decision(for: URL(string: "file:///etc/passwd")!) == .block)
        #expect(ReaderNavigationPolicy.decision(for: URL(string: "javascript:alert(1)")!) == .block)
        #expect(ReaderNavigationPolicy.decision(for: URL(string: "qiankunjie://collect")!) == .block)
    }

    @Test func HTTP链接会交给系统浏览器() {
        #expect(ReaderNavigationPolicy.decision(for: URL(string: "http://example.com")!) == .openExternally)
        #expect(ReaderNavigationPolicy.decision(for: URL(string: "https://example.com")!) == .openExternally)
    }
}
