import SwiftUI

enum CategoryDropResolution: Equatable {
    case move(
        movingCategoryID: Int,
        targetCategoryID: Int,
        reorderedCategoryIDs: [Int]
    )
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
            let originalCategoryIDs,
            let reorderedIDs = CategoryOrdering.reorderedIDs(
                originalCategoryIDs,
                moving: movingCategoryID,
                to: targetCategoryID,
                protecting: protectedIDs
            ),
            reorderedIDs != originalCategoryIDs
        else {
            return false
        }

        previewCategoryIDs = reorderedIDs
        return true
    }

    @discardableResult
    mutating func commit(
        moving movingCategoryID: Int,
        to targetCategoryID: Int,
        protecting protectedIDs: Set<Int>
    ) -> [Int]? {
        defer { reset() }
        guard
            draggedCategoryID == movingCategoryID,
            let originalCategoryIDs,
            let reorderedIDs = CategoryOrdering.reorderedIDs(
                originalCategoryIDs,
                moving: movingCategoryID,
                to: targetCategoryID,
                protecting: protectedIDs
            ),
            reorderedIDs != originalCategoryIDs
        else {
            return nil
        }
        return reorderedIDs
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
        categoryIDs: [Int],
        protectedCategoryIDs: Set<Int>,
        canDrop: Bool
    ) -> CategoryDropResolution {
        guard
            canDrop,
            let draggedCategoryID,
            draggedCategoryID != targetCategoryID,
            !targetIsSystem,
            let reorderedCategoryIDs = CategoryOrdering.reorderedIDs(
                categoryIDs,
                moving: draggedCategoryID,
                to: targetCategoryID,
                protecting: protectedCategoryIDs
            )
        else {
            return .cancel
        }
        return .move(
            movingCategoryID: draggedCategoryID,
            targetCategoryID: targetCategoryID,
            reorderedCategoryIDs: reorderedCategoryIDs
        )
    }

    private mutating func reset() {
        draggedCategoryID = nil
        previewCategoryIDs = nil
        originalCategoryIDs = nil
    }
}
