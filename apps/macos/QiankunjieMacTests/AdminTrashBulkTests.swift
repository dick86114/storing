import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct AdminTrashBulkTests {
    private let payload = Data(#"""
    {
      "scope": "orphans",
      "attempted": 3,
      "succeeded": 2,
      "failed": 1,
      "deleted_metadata": 0,
      "deleted_articles": 2,
      "failures": [
        {
          "article_id": 301,
          "user_id": null,
          "title": "Google",
          "reason": "文章状态已变化，请刷新后重试"
        }
      ]
    }
    """#.utf8)

    @Test func 批量清空响应解码成功并保留失败原因() throws {
        let result = try JSONDecoder.qiankunjie.decode(AdminTrashBulkResult.self, from: payload)

        #expect(result.scope == "orphans")
        #expect(result.attempted == 3)
        #expect(result.succeeded == 2)
        #expect(result.failed == 1)
        #expect(result.deletedMetadata == 0)
        #expect(result.deletedArticles == 2)
        #expect(result.failures.first?.articleId == 301)
        #expect(result.failures.first?.reason == "文章状态已变化，请刷新后重试")
    }

    @Test func 批量清空提示报告成功失败与失败明细() {
        let failure = AdminTrashBulkFailure(
            articleId: 301,
            userId: nil,
            title: "Google",
            reason: "文章状态已变化，请刷新后重试"
        )

        #expect(AdminTrashBulkPresentation.headline(scope: "orphans", succeeded: 2, failed: 1)
            == "孤儿文章清空完成：成功 2 条，失败 1 条")
        #expect(AdminTrashBulkPresentation.summary(deletedArticles: 2) == "物理删除全局文章 2 篇。")
        #expect(AdminTrashBulkPresentation.failureText(failure)
            == "Google（#301）：文章状态已变化，请刷新后重试")
    }

    @Test func 回收站界面提供两个独立批量清空入口() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("QiankunjieMac/Features/Admin/AdminTrashView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("clearDeleted"))
        #expect(source.contains("clearOrphans"))
        #expect(source.contains("确认清空已删除文章"))
        #expect(source.contains("确认清空孤儿文章"))
        #expect(source.contains("清空结果"))
        #expect(source.contains("AdminTrashBulkPresentation.failureText"))
    }
}
