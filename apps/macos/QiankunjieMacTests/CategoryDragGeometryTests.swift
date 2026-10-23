import QiankunjieCore
import SwiftUI
import Testing
@testable import QiankunjieMac

struct CategoryDragGeometryTests {
    @Test func 根据行frame中点选择正确目标分类() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 40)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 40, width: 300, height: 40)),
            CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 80, width: 300, height: 40)),
        ]

        let 落点 = CategoryDragGeometry.target(
            pointerY: 92,
            rows: 行,
            categoryIDs: [1, 2, 3],
            movingCategoryID: 1,
            protecting: []
        )

        #expect(落点 == CategoryDragDropTarget(categoryID: 3, placement: .after))
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 1,
                to: 落点?.categoryID ?? -1
            ) == [2, 3, 1]
        )
    }

    @Test func 行高不一致时按实际中点选择最近合法目标() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 20)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 20, width: 300, height: 90)),
            CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 110, width: 300, height: 20)),
        ]

        let 落点 = CategoryDragGeometry.target(
            pointerY: 90,
            rows: 行,
            categoryIDs: [1, 2, 3],
            movingCategoryID: 1,
            protecting: []
        )

        #expect(落点 == CategoryDragDropTarget(categoryID: 2, placement: .after))
    }

    @Test func 指针越过系统分类时停留在原区间最近合法目标() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 9, frame: CGRect(x: 0, y: 60, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 90, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 4, frame: CGRect(x: 0, y: 120, width: 300, height: 30)),
        ]

        let 落点 = CategoryDragGeometry.target(
            pointerY: 132,
            rows: 行,
            categoryIDs: [1, 2, 9, 3, 4],
            movingCategoryID: 1,
            protecting: [9]
        )

        #expect(落点 == CategoryDragDropTarget(categoryID: 2, placement: .after))
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 9, 3, 4],
                moving: 1,
                to: 落点?.categoryID ?? -1,
                protecting: [9]
            ) == [2, 1, 9, 3, 4]
        )
    }

    @Test func 指针位于列表外或拖动系统分类时没有落点() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 9, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 60, width: 300, height: 30)),
        ]

        #expect(
            CategoryDragGeometry.target(
                pointerY: 110,
                rows: 行,
                categoryIDs: [1, 9, 2],
                movingCategoryID: 1,
                protecting: [9]
            ) == nil
        )
        #expect(
            CategoryDragGeometry.target(
                pointerY: 45,
                rows: 行,
                categoryIDs: [1, 9, 2],
                movingCategoryID: 9,
                protecting: [9]
            ) == nil
        )
    }

    @Test func 指针水平离开列表时没有落点() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
        ]

        #expect(
            CategoryDragGeometry.target(
                pointerY: 45,
                pointerX: 320,
                rows: 行,
                categoryIDs: [1, 2],
                movingCategoryID: 1,
                protecting: []
            ) == nil
        )
    }

    @Test func 拖动位移不足或无目标时不会提交() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 60, width: 300, height: 30)),
        ]
        var 状态 = CategoryDragState()
        let 首次开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 短距离更新 = 状态.update(
            translation: CGSize(width: 0, height: 3),
            pointerY: 75,
            rows: 行,
            protecting: [],
            canDrop: true
        )
        let 短距离提交 = 状态.finish(protecting: [], canDrop: true, minimumDistance: 4)
        let 第二次开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 列表外更新 = 状态.update(
            translation: CGSize(width: 0, height: 20),
            pointerY: 110,
            rows: 行,
            protecting: [],
            canDrop: true
        )
        let 列表外提交 = 状态.finish(protecting: [], canDrop: true, minimumDistance: 4)

        #expect(首次开始)
        #expect(短距离更新)
        #expect(短距离提交 == nil)
        #expect(第二次开始)
        #expect(!列表外更新)
        #expect(列表外提交 == nil)
    }

    @Test func 落点与原始顺序相同时不提交() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
        ]
        var 状态 = CategoryDragState()
        let 已开始 = 状态.begin(categoryID: 2, categoryIDs: [1, 2])
        let 原位置更新 = 状态.update(
            translation: CGSize(width: 0, height: 12),
            pointerY: 44,
            rows: 行,
            protecting: [],
            canDrop: true
        )
        let 原位置提交 = 状态.finish(protecting: [], canDrop: true, minimumDistance: 4)

        #expect(已开始)
        #expect(!原位置更新)
        #expect(原位置提交 == nil)
    }

    @Test func 松手只生成一次完整排序提交() {
        let 行 = [
            CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
            CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 60, width: 300, height: 30)),
        ]
        var 状态 = CategoryDragState()
        let 已开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 已更新落点 = 状态.update(
            translation: CGSize(width: 0, height: 70),
            pointerY: 74,
            rows: 行,
            protecting: [],
            canDrop: true
        )
        let 提交 = 状态.finish(protecting: [], canDrop: true, minimumDistance: 4)
        let 重复提交 = 状态.finish(protecting: [], canDrop: true, minimumDistance: 4)

        #expect(已开始)
        #expect(已更新落点)
        #expect(
            提交 == CategoryDragCommit(
                movingCategoryID: 1,
                targetCategoryID: 3,
                reorderedCategoryIDs: [2, 3, 1]
            )
        )
        #expect(重复提交 == nil)
    }

    @Test func 管理页用户行只呈现可访问拖拽手柄而不呈现上下移动箭头() {
        let 分类一 = ArticleCategory(id: 1, name: "第一类", sortOrder: 10)
        let 分类二 = ArticleCategory(id: 2, name: "第二类", sortOrder: 20)
        let 系统分类 = ArticleCategory(id: 9, name: "待整理", sortOrder: 30, isSystem: true)

        let 用户行 = CategoryManagementRowPresentation.make(
            category: 分类二,
            categories: [分类一, 分类二, 系统分类],
            canReorder: true
        )
        let 系统行 = CategoryManagementRowPresentation.make(
            category: 系统分类,
            categories: [分类一, 分类二, 系统分类],
            canReorder: true
        )

        #expect(用户行.trailingControl == .reorderHandle(systemImage: "line.3.horizontal"))
        #expect(用户行.handleAccessibilityLabel == "拖动排序“第二类”")
        #expect(用户行.handleAccessibilityHint.contains("方向键"))
        #expect(用户行.canMoveUp)
        #expect(!用户行.canMoveDown)
        #expect(系统行.trailingControl == .systemLock(systemImage: "lock"))
        #expect(!系统行.canMoveUp)
        #expect(!系统行.canMoveDown)
    }
}
