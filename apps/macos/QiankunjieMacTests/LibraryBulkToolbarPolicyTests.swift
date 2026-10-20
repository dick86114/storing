import Foundation
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

    @Test func 未归档动作说明下一步会进入分类() {
        let copy = BulkToolbarPolicy.confirmation(for: .archive, selectedCount: 3)

        #expect(copy.title == "归档 3 篇文章并分类？")
        #expect(copy.confirmTitle == "归档并分类")
        #expect(copy.message.contains("下一步可选择分类，或交给 AI 判断"))
    }

    @Test func 界面文案解释分类依赖归档() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let picker = try String(contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Library/BulkCategorySelectionSheet.swift"), encoding: .utf8)
        let reader = try String(contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Reader/ReaderPaneView.swift"), encoding: .utf8)
        let actionBar = try String(contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Reader/ArticleActionBar.swift"), encoding: .utf8)
        let library = try String(contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Library/CompactArticleListView.swift"), encoding: .utf8)
        let categorySettings = try String(contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Settings/CategoryManagementView.swift"), encoding: .utf8)

        #expect(picker.contains("分类只用于归档文章"))
        #expect(reader.contains("分类只用于归档文章"))
        #expect(actionBar.contains("\"归档并分类\""))
        #expect(library.contains("归档后的文章会被整理到这里，并可按分类浏览"))
        #expect(categorySettings.contains("分类只用于组织已归档文章"))
    }
}
