import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct BulkObsidianExportServiceTests {
    @Test func 单篇失败不中断批量导出() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("bulk-obsidian-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let loader = 模拟Obsidian详情仓库(details: [
            1: .init(id: 1, title: "第一篇", contentMarkdown: "# 第一篇"),
            3: .init(id: 3, title: "第三篇", contentMarkdown: "# 第三篇"),
        ], failure: 2)
        let exporter = 模拟Obsidian导出器()
        let service = BulkObsidianExportService(
            detailLoader: loader,
            exporter: exporter,
            settings: .init(directoryURL: directory)
        )

        let summary = try await service.export(articleIDs: [1, 2, 3])

        #expect(summary.succeededIDs == [1, 3])
        #expect(summary.failures.first?.articleID == 2)
        #expect(summary.failures.first?.message == "测试失败")
        #expect(await loader.requestedIDsSnapshot() == [1, 2, 3])
        #expect(exporter.exportedTitles == ["第一篇", "第三篇"])
    }
}

private actor 模拟Obsidian详情仓库: BulkObsidianDetailLoading {
    let details: [Int: ArticleDetail]
    let failure: Int?
    private(set) var requestedIDs: [Int] = []

    init(details: [Int: ArticleDetail], failure: Int?) {
        self.details = details
        self.failure = failure
    }

    func load(articleID: Int) async throws -> ArticleDetail {
        requestedIDs.append(articleID)
        if articleID == failure {
            throw 测试错误.失败
        }
        guard let detail = details[articleID] else {
            throw 测试错误.失败
        }
        return detail
    }

    func requestedIDsSnapshot() async -> [Int] {
        requestedIDs
    }
}

private final class 模拟Obsidian导出器: BulkObsidianArticleExporting, @unchecked Sendable {
    private(set) var exportedTitles: [String] = []

    func export(_ document: ArticleExportDocument) throws -> URL {
        exportedTitles.append(document.title)
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("\(document.title).md")
    }
}

private enum 测试错误: LocalizedError {
    case 失败

    var errorDescription: String? {
        "测试失败"
    }
}
