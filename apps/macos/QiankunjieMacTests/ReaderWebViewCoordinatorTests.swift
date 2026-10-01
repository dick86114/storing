import QiankunjieReader
import Testing
import WebKit
@testable import QiankunjieMac

@MainActor
struct ReaderWebViewCoordinatorTests {
    @Test func 阅读器样式注入字号宽度和图片查看脚本() {
        let output = ReaderContentStyle.applying(
            to: "<html><head><title>文章</title></head><body>正文</body></html>",
            font: .large,
            contentWidth: .wide
        )

        #expect(output.contains("--reader-font-size: 17px"))
        #expect(output.contains("--reader-content-width: 95%"))
        #expect(output.contains("readerImage"))
        #expect(output.contains("cursor: zoom-in"))
        #expect(output.localizedCaseInsensitiveContains("</head><body>正文</body></html>"))
    }

    @Test func 深色外观注入正文暗色主题() {
        let output = ReaderContentStyle.applying(
            to: "<html><head><title>文章</title></head><body>正文</body></html>",
            font: .standard,
            contentWidth: .normal,
            colorScheme: .dark
        )

        #expect(output.contains("setAttribute('data-storing-reader-theme', 'dark')"))
        #expect(output.contains("color-scheme: dark"))
        #expect(output.contains("html[data-storing-reader-theme=\"dark\"] body"))
        #expect(output.contains("--reader-dark-background: #071A12"))
        #expect(output.contains("__storingReaderTheme"))
    }

    @Test func 浅色外观不写入暗色主题属性() {
        let output = ReaderContentStyle.applying(
            to: "<html><head><title>文章</title></head><body>正文</body></html>",
            font: .standard,
            contentWidth: .normal,
            colorScheme: .light
        )

        #expect(output.contains("setAttribute('data-storing-reader-theme', 'light')"))
        #expect(output.contains("color-scheme: light"))
    }

    @Test func 外观变化会触发样式重新应用() {
        let light = ReaderContentStyle(font: .standard, contentWidth: .normal, colorScheme: .light)
        let dark = ReaderContentStyle(font: .standard, contentWidth: .normal, colorScheme: .dark)

        #expect(light.token != dark.token)
        #expect(dark.dynamicJavaScript.contains("__storingReaderTheme.set('dark')"))
    }

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
