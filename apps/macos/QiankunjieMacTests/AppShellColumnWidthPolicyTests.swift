import CoreGraphics
import Foundation
import Testing
@testable import QiankunjieMac

struct AppShellColumnWidthPolicyTests {
    @Test func 默认中栏保持适中() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(workspaceWidth: 1200)

        #expect(width.minimum == 340)
        #expect(width.width == 620)
        #expect(width.maximum == 880)
    }

    @Test func 用户调整后的中栏宽度不会因切换文章变化() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(workspaceWidth: 1200, overrideWidth: 420)

        #expect(width.minimum == 340)
        #expect(width.width == 420)
        #expect(width.maximum == 880)
    }

    @Test func 文章列表会为阅读栏保留最小宽度() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(workspaceWidth: 700, overrideWidth: 760)

        #expect(width.minimum == 340)
        #expect(width.width == 380)
        #expect(width.maximum == 380)
    }

    @Test func 拖拽宽度以固定起点计算并限制在可用范围内() {
        let policy = AppShellColumnWidthPolicy()

        #expect(
            policy.draggedContentWidth(
                startingWidth: 420,
                translation: 160,
                workspaceWidth: 1200
            ) == 580
        )
        #expect(
            policy.draggedContentWidth(
                startingWidth: 420,
                translation: -300,
                workspaceWidth: 1200
            ) == 340
        )
        #expect(
            policy.draggedContentWidth(
                startingWidth: 420,
                translation: 800,
                workspaceWidth: 1200
            ) == 880
        )
    }

    @Test func 拖拽布局隔离在独立视图并使用固定坐标空间() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent(
                    "QiankunjieMac/App/LibraryWorkspaceView.swift"
                ),
            encoding: .utf8
        )

        #expect(source.contains("struct LibraryWorkspaceView"))
        #expect(source.contains(".coordinateSpace(name: Self.coordinateSpaceName)"))
        #expect(
            source.contains(
                "coordinateSpace: .named(Self.coordinateSpaceName)"
            )
        )
        #expect(source.contains("onCommitWidth(finalWidth)"))
    }
}
