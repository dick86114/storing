import Foundation
import Testing
@testable import QiankunjieMac

@MainActor
struct ReaderImageDownloadTests {
    @Test func 图片下载文件名保留原始名称和扩展名() {
        let url = URL(string: "https://example.com/images/文章 标题.webp?width=1600")!

        #expect(ReaderImageDownload.suggestedFilename(for: url) == "文章 标题.webp")
    }

    @Test func 图片下载文件名使用安全默认值() {
        let url = URL(string: "https://example.com/")!

        #expect(ReaderImageDownload.suggestedFilename(for: url) == "图片.jpg")
    }
}
