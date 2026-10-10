import Foundation
import QiankunjieLibrary
import Testing
@testable import QiankunjieMac

struct BulkExportArchiveNameTests {
    @Test func 导出包名包含任务ID且无路径分隔符() {
        let job = ArticleBulkExportJob(
            id: 82,
            format: "zip",
            status: .succeeded,
            requestedCount: 3,
            succeededCount: 3,
            failedCount: 0,
            downloadURL: "/articles/bulk-export/82/download",
            createdAt: nil,
            finishedAt: nil,
            expiresAt: nil
        )

        #expect(BulkArticleExportService.archiveName(for: job) == "storing-export-82.zip")
        #expect(!BulkArticleExportService.archiveName(for: job).contains("/"))
    }
}
