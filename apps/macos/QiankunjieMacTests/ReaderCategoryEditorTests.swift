import Foundation
import Testing
@testable import QiankunjieMac

struct ReaderCategoryEditorTests {
    @Test func 阅读器分类名可直接打开修改分类入口() throws {
        let paneURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("QiankunjieMac/Features/Reader/ReaderPaneView.swift")
        let modelURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift")
        let pane = try String(contentsOf: paneURL, encoding: .utf8)
        let model = try String(contentsOf: modelURL, encoding: .utf8)

        #expect(pane.contains("ReaderCategoryEditorSheet"))
        #expect(pane.contains("isCategoryEditorPresented = true"))
        #expect(pane.contains("model.moveToCategory"))
        #expect(model.contains("func loadCategories() async"))
        #expect(model.contains("func createCategory(name: String) async -> ArticleCategory?"))
        #expect(model.contains("func moveToCategory(_ categoryID: Int) async -> Bool"))
    }
}
