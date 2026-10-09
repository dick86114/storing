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
}
