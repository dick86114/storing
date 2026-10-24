import SwiftUI
import Testing
@testable import QiankunjieMac

struct CategoryDragStateTests {
    private let 三行 = [
        CategoryDragRowFrame(categoryID: 1, frame: CGRect(x: 0, y: 0, width: 300, height: 30)),
        CategoryDragRowFrame(categoryID: 2, frame: CGRect(x: 0, y: 30, width: 300, height: 30)),
        CategoryDragRowFrame(categoryID: 3, frame: CGRect(x: 0, y: 60, width: 300, height: 30)),
    ]

    @Test func 取消拖拽会清除位移与落点() {
        var 状态 = CategoryDragState()
        let 已开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 已更新落点 = 状态.update(
            translation: CGSize(width: 0, height: 70),
            pointerY: 74,
            rows: 三行,
            protecting: [],
            canDrop: true
        )
        #expect(已开始)
        #expect(已更新落点)
        #expect(状态.dropTarget == CategoryDragDropTarget(categoryID: 3, placement: .after))

        状态.cancel()

        #expect(!状态.isDragging)
        #expect(状态.translation == .zero)
        #expect(状态.dropTarget == nil)
    }

    @Test func 拖拽未结束时拒绝再次开始() {
        var 状态 = CategoryDragState()
        let 首次开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 再次开始 = 状态.begin(categoryID: 2, categoryIDs: [1, 2, 3])
        #expect(首次开始)
        #expect(!再次开始)
        #expect(状态.draggedCategoryID == 1)
    }

    @Test func 目录不可排序时清除已有落点() {
        var 状态 = CategoryDragState()
        let 已开始 = 状态.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 已更新落点 = 状态.update(
            translation: CGSize(width: 0, height: 70),
            pointerY: 74,
            rows: 三行,
            protecting: [],
            canDrop: true
        )
        let 不可排序时更新 = 状态.update(
            translation: CGSize(width: 0, height: 70),
            pointerY: 74,
            rows: 三行,
            protecting: [],
            canDrop: false
        )
        #expect(已开始)
        #expect(已更新落点)
        #expect(!不可排序时更新)
        #expect(状态.dropTarget == nil)
    }
}
