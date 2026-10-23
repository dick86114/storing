import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct ReaderCategoryEditorTests {
    @Test func 阅读器分类标签使用共享选择器Popover() throws {
        let repositoryRoot = 仓库根目录()
        let pane = try String(
            contentsOf: repositoryRoot.appendingPathComponent(
                "QiankunjieMac/Features/Reader/ReaderPaneView.swift"
            ),
            encoding: .utf8
        )

        #expect(pane.contains("categoryCatalog: CategoryCatalogModel"))
        #expect(pane.contains(".popover(isPresented: $isCategoryPickerPresented"))
        #expect(pane.contains("arrowEdge: .leading"))
        #expect(pane.contains("CategoryPickerContent("))
        #expect(pane.contains("\"修改分类\""))
        #expect(pane.contains("\"选择分类，或让 AI 判断\""))
        #expect(pane.contains("recordRecent(categoryID: category.id)"))
        #expect(
            ReaderCategoryOutcomeMapper.outcome(
                succeeded: true,
                error: nil,
                message: nil
            ) == .success(succeededCount: 1, skippedCount: 0)
        )
        #expect(
            ReaderCategoryOutcomeMapper.outcome(
                succeeded: false,
                error: .contentUnavailable,
                message: "请求的文章不可用"
            ) == .categoryUnavailable(message: "请求的文章不可用")
        )
        #expect(
            ReaderCategoryOutcomeMapper.outcome(
                succeeded: false,
                error: .network,
                message: "网络连接失败，请稍后重试"
            ) == .failure(message: "网络连接失败，请稍后重试")
        )
    }

    @Test func 归档并分类使用共享选择器Sheet() throws {
        let pane = try String(
            contentsOf: 仓库根目录().appendingPathComponent(
                "QiankunjieMac/Features/Reader/ReaderPaneView.swift"
            ),
            encoding: .utf8
        )

        #expect(pane.contains(".sheet(item: $categorySheetMode)"))
        #expect(pane.contains("\"归档并分类\""))
        #expect(pane.contains("\"分类只用于归档文章\""))
        #expect(pane.contains("CategoryPickerContent("))
        #expect(pane.contains("CategoryPickerModel("))
    }

    @Test func 阅读器不再自行加载或创建分类目录() throws {
        let repositoryRoot = 仓库根目录()
        let readerModel = try String(
            contentsOf: repositoryRoot.appendingPathComponent(
                "Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift"
            ),
            encoding: .utf8
        )
        let uiLabFixtures = try String(
            contentsOf: repositoryRoot.appendingPathComponent(
                "QiankunjieMac/UILab/UILabFixtures.swift"
            ),
            encoding: .utf8
        )

        #expect(!readerModel.contains("availableCategories"))
        #expect(!readerModel.contains("isLoadingCategories"))
        #expect(!readerModel.contains("isCreatingCategory"))
        #expect(!readerModel.contains("categoryErrorMessage"))
        #expect(!readerModel.contains("func loadCategories()"))
        #expect(!readerModel.contains("func createCategory(name:"))
        #expect(!readerModel.contains("func categories()"))
        #expect(!uiLabFixtures.contains("func categories()"))
        #expect(!uiLabFixtures.contains("func createCategory(name:"))
    }

    private func 仓库根目录() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}
