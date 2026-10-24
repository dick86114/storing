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

    @Test func 高级编辑器在任一操作进行中禁用输入和操作() throws {
        let source = try 读取源码("QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift")
        let busyReferenceCount = source.components(separatedBy: "isBusy").count - 1

        #expect(source.contains("private var isBusy: Bool {\n        model.isBusy"))
        #expect(source.contains(".disabled(isBusy)"))
        #expect(source.contains("|| isBusy"))
        #expect(source.contains("model.isBusy ? \"处理中…\""))
        #expect(busyReferenceCount >= 10)
    }

    @Test func 合并部分成功会提供刷新并说明源分类保留停用() throws {
        let view = try 读取源码("QiankunjieMac/Features/Settings/CategoryManagementView.swift")
        let model = try 读取源码("QiankunjieMac/Features/Settings/CategoryManagementModel.swift")

        #expect(view.contains("源分类随后停用，并保留在已停用分类中"))
        #expect(view.contains("model.shouldOfferRefreshAfterMerge"))
        #expect(view.contains("刷新分类目录"))
        #expect(view.contains("if model.errorMessage == nil"))
        #expect(model.contains("合并已提交，但分类目录刷新失败，请重试刷新"))
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
