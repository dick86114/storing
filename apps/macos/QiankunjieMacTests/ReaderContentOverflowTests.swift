import Foundation
import Testing
@testable import QiankunjieMac

struct ReaderContentOverflowTests {
    @Test func 阅读器强制超长链接换行并阻止正文横向溢出() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("QiankunjieMac/Features/Reader/ReaderWebView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("html, body {"))
        #expect(source.contains("overflow-x: hidden !important;"))
        #expect(source.contains("body, body * {"))
        #expect(source.contains("overflow-wrap: anywhere !important;"))
        #expect(source.contains("word-break: break-word !important;"))
        #expect(source.contains("white-space: pre-wrap !important;"))
    }
}
