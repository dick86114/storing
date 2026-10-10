import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

struct BulkArticlePolicyTests {
    @Test func 各视图批量动作与设计一致() {
        #expect(BulkArticlePolicy.toolbarActions(for: .inbox) == [.favorite, .archive, .delete, .permanentDelete, .generateAI, .publish, .exportZIP, .bulkObsidian])
        #expect(!BulkArticlePolicy.toolbarActions(for: .inbox).contains(.unpublish))
        #expect(BulkArticlePolicy.toolbarActions(for: .published) == [.unpublish, .delete, .permanentDelete, .exportZIP, .bulkObsidian])
    }

    @Test func 超过200篇抛出无效输入() {
        #expect(throws: AppError.invalidInput) {
            _ = try BulkArticlePolicy.validatedIDs(Array(1...201))
        }
        #expect(throws: AppError.invalidInput) {
            _ = try BulkArticlePolicy.validatedIDs([1, 0])
        }
    }

    @Test func macOS包含批量Obsidian动作() {
        #expect(BulkArticlePolicy.toolbarActions(for: .archive).contains(.bulkObsidian))
        #expect(!ArticleBulkAction.allCases.map(\.rawValue).contains("bulkObsidian"))
    }
}
