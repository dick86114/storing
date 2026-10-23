import SwiftUI

enum CategoryDropResolution: Equatable {
    case move(movingCategoryID: Int, targetCategoryID: Int)
    case cancel
}

/// 分类拖拽的单一状态源；无效落点和拖拽会话结束都必须经过 cancel 或 commit。
struct CategoryDragState {
    private(set) var draggedCategoryID: Int?
    private(set) var previewCategoryIDs: [Int]?
    private(set) var originalCategoryIDs: [Int]?

    @discardableResult
    mutating func begin(categoryID: Int, categoryIDs: [Int]) -> Bool {
        guard
            draggedCategoryID == nil,
            categoryIDs.contains(categoryID),
            Set(categoryIDs).count == categoryIDs.count
        else {
            return false
        }

        draggedCategoryID = categoryID
        previewCategoryIDs = categoryIDs
        originalCategoryIDs = categoryIDs
        return true
    }

    @discardableResult
    mutating func preview(
        moving movingCategoryID: Int,
        to targetCategoryID: Int,
        protecting protectedIDs: Set<Int>
    ) -> Bool {
        guard
            draggedCategoryID == movingCategoryID,
            let currentIDs = previewCategoryIDs,
            let reorderedIDs = CategoryOrdering.reorderedIDs(
                currentIDs,
                moving: movingCategoryID,
                to: targetCategoryID,
                protecting: protectedIDs
            )
        else {
            return false
        }

        previewCategoryIDs = reorderedIDs
        return true
    }

    @discardableResult
    mutating func commit() -> [Int]? {
        let committedIDs = previewCategoryIDs == originalCategoryIDs ? nil : previewCategoryIDs
        reset()
        return committedIDs
    }

    mutating func cancel() {
        reset()
    }

    /// 成功落点由 performDrop 提交；取消、禁止和窗口外结束则立即恢复目录顺序。
    static func shouldCancel(for phase: DragSession.Phase) -> Bool {
        switch phase {
        case .ended(let operation):
            if case .move = operation {
                return false
            }
            return true
        case .dataTransferCompleted:
            return true
        default:
            return false
        }
    }

    static func dropResolution(
        draggedCategoryID: Int?,
        targetCategoryID: Int,
        targetIsSystem: Bool,
        canDrop: Bool
    ) -> CategoryDropResolution {
        guard
            canDrop,
            let draggedCategoryID,
            draggedCategoryID != targetCategoryID,
            !targetIsSystem
        else {
            return .cancel
        }
        return .move(
            movingCategoryID: draggedCategoryID,
            targetCategoryID: targetCategoryID
        )
    }

    private mutating func reset() {
        draggedCategoryID = nil
        previewCategoryIDs = nil
        originalCategoryIDs = nil
    }
}
