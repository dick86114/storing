import QiankunjieLibrary
import Testing
@testable import QiankunjieMac

struct LibraryBulkToolbarPolicyTests {
    @Test func 所有动作都有确认文案() {
        for action in BulkToolbarAction.allCases {
            let copy = BulkToolbarPolicy.confirmation(for: action, selectedCount: 3)

            #expect(!copy.title.isEmpty)
            #expect(!copy.message.isEmpty)
            #expect(!copy.confirmTitle.isEmpty)
            #expect(copy.message.contains("3"))
        }
    }

    @Test func 删除和彻底删除是危险动作() {
        #expect(BulkToolbarPolicy.confirmation(for: .delete, selectedCount: 2).isDestructive)
        #expect(BulkToolbarPolicy.confirmation(for: .permanentDelete, selectedCount: 2).isDestructive)
        #expect(!BulkToolbarPolicy.confirmation(for: .favorite, selectedCount: 2).isDestructive)
        #expect(
            BulkToolbarPolicy
                .confirmation(for: .permanentDelete, selectedCount: 1)
                .message
                .contains("不可恢复")
        )
    }

    @Test func 运行中禁止退出() {
        #expect(BulkToolbarPolicy.canExit(bulkRunningAction: nil))
        #expect(!BulkToolbarPolicy.canExit(bulkRunningAction: .favorite))
    }

    @Test func 批量菜单中的导出标题可区分() {
        #expect(BulkToolbarPolicy.menuTitle(for: .exportZIP) == "导出 ZIP")
        #expect(BulkToolbarPolicy.menuTitle(for: .bulkObsidian) == "导出 Obsidian")

        let titles = BulkArticlePolicy.toolbarActions(for: .archive).map(BulkToolbarPolicy.menuTitle(for:))
        #expect(Set(titles).count == titles.count)
    }
}
