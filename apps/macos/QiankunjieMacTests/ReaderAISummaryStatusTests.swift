import AppKit
import Foundation
import Testing
@testable import QiankunjieMac

struct ReaderAISummaryStatusTests {
    @Test func 阅读器将AI状态合并进摘要卡片() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("QiankunjieMac/Features/Reader/ReaderPaneView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(!source.contains("ReaderAIStatusCard"))
        #expect(source.contains("ReaderAISummaryCard("))
        #expect(source.contains("ReaderAISummaryStatusPresentation(status:"))
        #expect(source.contains("aiModel"))
        #expect(source.contains("aiTotalTokens"))
        #expect(source.contains("重试"))
    }

    @Test func 非终态使用标题旁图标且终完成态不显示状态() {
        let queued = ReaderAISummaryStatusPresentation(status: "queued")
        let running = ReaderAISummaryStatusPresentation(status: "running")
        let failed = ReaderAISummaryStatusPresentation(status: "failed")

        #expect(queued?.systemImage == "clock")
        #expect(running?.isRunning == true)
        #expect(failed?.tone == .failed)
        #expect(ReaderAISummaryStatusPresentation(status: "succeeded") == nil)
        #expect(ReaderAISummaryStatusPresentation(status: "not_generated") == nil)
    }

    @Test func AI摘要卡片提供复制入口并允许选择文本() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("QiankunjieMac/Features/Reader/ReaderPaneView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("复制 AI 摘要"))
        #expect(source.contains(".textSelection(.enabled)"))
    }

    @MainActor
    @Test func AI摘要复制清除首尾空白并写入剪贴板() {
        let pasteboard = NSPasteboard(
            name: NSPasteboard.Name("storing.reader.ai-summary.\(UUID().uuidString)")
        )
        defer { pasteboard.clearContents() }

        #expect(ReaderAISummaryClipboard.copy("  这是摘要文本。\n", to: pasteboard))
        #expect(pasteboard.string(forType: .string) == "这是摘要文本。")
    }
}
