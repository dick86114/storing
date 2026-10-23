import SwiftUI
import Testing
@testable import QiankunjieMac

struct CategoryDragStateTests {
    @Test func 拖拽预览后取消会恢复到原始目录顺序() {
        let 原始顺序 = [1, 2, 3, 4]
        var state = CategoryDragState()

        let 已开始拖拽 = state.begin(categoryID: 1, categoryIDs: 原始顺序)
        let 已生成预览 = state.preview(moving: 1, to: 4, protecting: [])
        #expect(已开始拖拽)
        #expect(已生成预览)
        #expect(state.previewCategoryIDs == [2, 3, 4, 1])

        state.cancel()

        #expect(state.draggedCategoryID == nil)
        #expect(state.previewCategoryIDs == nil)
        #expect(state.previewCategoryIDs ?? 原始顺序 == 原始顺序)
    }

    @Test func 有效落点提交后返回完整顺序并清除拖拽预览() {
        var state = CategoryDragState()
        let 已开始拖拽 = state.begin(categoryID: 3, categoryIDs: [1, 2, 3, 4])
        let 已生成预览 = state.preview(moving: 3, to: 2, protecting: [])
        #expect(已开始拖拽)
        #expect(已生成预览)

        #expect(state.commit() == [1, 3, 2, 4])
        #expect(state.draggedCategoryID == nil)
        #expect(state.previewCategoryIDs == nil)
    }

    @Test func 未产生顺序变化的拖拽不会提交空排序() {
        var state = CategoryDragState()
        let 已开始拖拽 = state.begin(categoryID: 2, categoryIDs: [1, 2, 3])

        #expect(已开始拖拽)
        #expect(state.commit() == nil)
        #expect(state.draggedCategoryID == nil)
    }

    @Test func 无效预览不会生成跨过系统分类的新顺序() {
        var state = CategoryDragState()
        let 已开始拖拽 = state.begin(categoryID: 1, categoryIDs: [1, 2, 3])
        let 已生成预览 = state.preview(moving: 1, to: 3, protecting: [2])

        #expect(已开始拖拽)
        #expect(!已生成预览)
        #expect(state.previewCategoryIDs == [1, 2, 3])
    }

    @Test func 拖拽会话取消或窗口外结束会触发清理() {
        #expect(CategoryDragState.shouldCancel(for: .initial) == false)
        #expect(CategoryDragState.shouldCancel(for: .active) == false)
        #expect(CategoryDragState.shouldCancel(for: .ended(.cancel)))
        #expect(CategoryDragState.shouldCancel(for: .ended(.forbidden)))
        #expect(CategoryDragState.shouldCancel(for: .ended(.move)) == false)
        #expect(CategoryDragState.shouldCancel(for: .dataTransferCompleted))
    }

    @Test func 原分类系统分类和不可排序状态都会解析为取消落点() {
        #expect(
            CategoryDragState.dropResolution(
                draggedCategoryID: 1,
                targetCategoryID: 1,
                targetIsSystem: false,
                canDrop: true
            ) == .cancel
        )
        #expect(
            CategoryDragState.dropResolution(
                draggedCategoryID: 1,
                targetCategoryID: 2,
                targetIsSystem: true,
                canDrop: true
            ) == .cancel
        )
        #expect(
            CategoryDragState.dropResolution(
                draggedCategoryID: 1,
                targetCategoryID: 2,
                targetIsSystem: false,
                canDrop: false
            ) == .cancel
        )
        #expect(
            CategoryDragState.dropResolution(
                draggedCategoryID: 1,
                targetCategoryID: 2,
                targetIsSystem: false,
                canDrop: true
            ) == .move(movingCategoryID: 1, targetCategoryID: 2)
        )
    }
}
