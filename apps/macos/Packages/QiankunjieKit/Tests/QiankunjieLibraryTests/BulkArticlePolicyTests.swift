import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

struct BulkArticlePolicyTests {
    @Test func 各视图批量动作与设计一致() {
        #expect(
            BulkArticlePolicy.toolbarActions(for: .inbox)
                == [.favorite, .archive, .generateAI, .publish, .exportZIP, .bulkObsidian, .delete, .permanentDelete]
        )
        #expect(!BulkArticlePolicy.toolbarActions(for: .inbox).contains(.unpublish))
        #expect(
            BulkArticlePolicy.toolbarActions(for: .published)
                == [.unpublish, .exportZIP, .bulkObsidian, .delete, .permanentDelete]
        )
    }

    @Test func 动作分组覆盖全部动作且删除类在最后() {
        let view = LibraryView.archive
        let grouped = BulkArticlePolicy.actionGroups(for: view).flatMap {
            BulkArticlePolicy.actions(in: $0, for: view)
        }

        #expect(grouped == BulkArticlePolicy.toolbarActions(for: view))
        #expect(BulkArticlePolicy.actionGroups(for: view).last == .destructive)
        // 已发布视图里没有收藏/归档，整理分组不应出现。
        #expect(BulkArticlePolicy.actionGroups(for: .published) == [.publish, .destructive])
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
