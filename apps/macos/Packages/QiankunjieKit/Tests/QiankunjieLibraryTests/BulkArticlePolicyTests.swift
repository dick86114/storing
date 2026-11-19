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

    @Test func 归档单篇文章菜单按状态显示收藏和发布() {
        let organize = BulkActionGroup.organize
        let publish = BulkActionGroup.publish

        #expect(
            BulkArticlePolicy.actions(in: organize, for: ArticleCard(id: 1), view: .archive)
                == [.favorite]
        )
        #expect(
            BulkArticlePolicy.actions(
                in: organize,
                for: ArticleCard(id: 2, isFavorited: true),
                view: .archive
            ) == [.unfavorite]
        )
        #expect(
            BulkArticlePolicy.actions(in: publish, for: ArticleCard(id: 3), view: .archive)
                == [.publish, .exportZIP, .bulkObsidian]
        )
        #expect(
            BulkArticlePolicy.actions(
                in: publish,
                for: ArticleCard(id: 4, isPublished: true),
                view: .archive
            ) == [.unpublish, .exportZIP, .bulkObsidian]
        )
    }

    @Test func 收件箱单篇文章菜单不包含分类动作() {
        let categorize = BulkActionGroup.categorize

        #expect(
            BulkArticlePolicy.actions(in: categorize, for: ArticleCard(id: 1), view: .inbox)
                == [.generateAI]
        )
    }

    @Test func 收藏批量菜单只有全部已归档才显示分类动作() {
        let categorize = BulkActionGroup.categorize

        #expect(
            BulkArticlePolicy.actions(in: categorize, for: [ArticleCard(id: 1)], view: .favorites)
                == [.generateAI]
        )
        #expect(
            BulkArticlePolicy.actions(
                in: categorize,
                for: [ArticleCard(id: 2, isArchived: true), ArticleCard(id: 3)],
                view: .favorites
            )
                == [.generateAI]
        )
        #expect(
            BulkArticlePolicy.actions(
                in: categorize,
                for: [ArticleCard(id: 4, isArchived: true), ArticleCard(id: 5, isArchived: true)],
                view: .favorites
            )
                == [.setCategory, .reclassify, .generateAI]
        )
    }

    @Test func 归档批量菜单按文章状态聚合整理动作() {
        let organize = BulkActionGroup.organize
        let mixed = [
            ArticleCard(id: 1, isFavorited: true, isArchived: true),
            ArticleCard(id: 2, isArchived: true),
        ]
        let allFavorited = [
            ArticleCard(id: 3, isFavorited: true, isArchived: true),
            ArticleCard(id: 4, isFavorited: true, isArchived: true),
        ]

        #expect(
            BulkArticlePolicy.actions(in: organize, for: mixed, view: .archive)
                == [.favorite, .unfavorite, .unarchive]
        )
        #expect(
            BulkArticlePolicy.actions(in: organize, for: allFavorited, view: .archive)
                == [.unfavorite, .unarchive]
        )
    }

    @Test func 收藏里只有已归档文章才有分类动作() {
        let categorize = BulkActionGroup.categorize

        #expect(
            BulkArticlePolicy.actions(in: categorize, for: ArticleCard(id: 1), view: .favorites)
                == [.generateAI]
        )
        #expect(
            BulkArticlePolicy.actions(in: categorize, for: ArticleCard(id: 2, isArchived: true), view: .favorites)
                == [.setCategory, .reclassify, .generateAI]
        )
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
