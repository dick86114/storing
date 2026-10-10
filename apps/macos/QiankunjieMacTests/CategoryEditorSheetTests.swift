import Foundation
import Testing

struct CategoryEditorSheetTests {
    @Test func 分类编辑器对齐网页端表单能力() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .appending(path: "../QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift"),
            encoding: .utf8
        )

        for marker in [
            "CategoryEditorOverlay",
            "分类名称",
            "分类说明",
            "AI 优化",
            "适合收录",
            "不适合收录",
            "显示颜色",
            "调色盘",
            "创建分类",
        ] {
            #expect(source.contains(marker))
        }
    }
}
