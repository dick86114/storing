import QiankunjieReader
import Testing
import WebKit
@testable import QiankunjieMac

@MainActor
struct ReaderWebViewCoordinatorTests {
    @Test func 初始服务端文档允许加载并保留原文资源地址() {
        let action = ReaderWebViewCoordinator.mainNavigationAction(
            url: URL(string: "https://mp.weixin.qq.com/s/demo")!,
            isServerHTMLLoading: true,
            navigationType: .other
        )

        #expect(action == .allow)
    }

    @Test func 初始本地文档没有地址时允许加载() {
        let action = ReaderWebViewCoordinator.mainNavigationAction(
            url: nil,
            isServerHTMLLoading: true,
            navigationType: .other
        )

        #expect(action == .allow)
    }

    @Test func 服务端文档渲染完成后的原文链接交给系统浏览器() throws {
        let originalURL = URL(string: "https://mp.weixin.qq.com/s/demo")!
        let action = ReaderWebViewCoordinator.mainNavigationAction(
            url: originalURL,
            isServerHTMLLoading: false,
            navigationType: .linkActivated
        )

        #expect(action == .openExternally(originalURL))
    }

    @Test func 服务端文档渲染完成后的文件和脚本导航被阻止() {
        let fileAction = ReaderWebViewCoordinator.mainNavigationAction(
            url: URL(string: "file:///tmp/a.html")!,
            isServerHTMLLoading: false,
            navigationType: .linkActivated
        )
        let scriptAction = ReaderWebViewCoordinator.mainNavigationAction(
            url: URL(string: "javascript:alert(1)")!,
            isServerHTMLLoading: false,
            navigationType: .other
        )

        #expect(fileAction == .block)
        #expect(scriptAction == .block)
    }
}
