import Foundation
import Testing

struct CategoryEditorSheetTests {
    @Test func 高级编辑器保留完整规则字段() throws {
        let source = try 读取源码("QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift")

        for marker in [
            "CategoryEditorOverlay",
            "分类名称",
            "分类说明",
            "AI 优化",
            "适合收录",
            "不适合收录",
            "显示颜色",
            "调色盘",
        ] {
            #expect(source.contains(marker))
        }
    }

    @Test func 新增分类复用快速创建视图且高级编辑器只用于编辑() throws {
        let source = try 读取源码("QiankunjieMac/Features/Settings/CategoryManagementView.swift")

        #expect(source.contains("CategoryQuickCreateView("))
        #expect(source.contains("CategoryEditorOverlay(model: model, category: category)"))
        #expect(!source.contains("CategoryEditorOverlay(model: model, category: nil)"))
    }

    @Test func 分类管理页使用应用共享目录() throws {
        let source = try 读取源码("QiankunjieMac/App/RootWindow.swift")

        #expect(source.contains("CategoryManagementView(catalog: model.categoryCatalog)"))
    }

    private func 读取源码(_ relativePath: String) throws -> String {
        try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .appending(path: "../\(relativePath)"),
            encoding: .utf8
        )
    }
}
