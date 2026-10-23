import Foundation
import SwiftUI

/// 分类行在拖拽命名坐标系中的真实布局。
struct CategoryDragRowFrame: Equatable {
    let categoryID: Int
    let frame: CGRect
}

enum CategoryDropPlacement: Equatable {
    case before
    case after
}

/// 实际纵向拖动方向；目标行必须位于被拖动行的同侧。
enum CategoryDragDirection: Equatable {
    case upward
    case downward
}

struct CategoryDragDropTarget: Equatable {
    let categoryID: Int
    let placement: CategoryDropPlacement
}

struct CategoryDragCommit: Equatable {
    let movingCategoryID: Int
    let targetCategoryID: Int
    let reorderedCategoryIDs: [Int]
}

/// 只根据原始行布局和指针位置计算落点，不改变 ForEach 的数据身份。
enum CategoryDragGeometry {
    /// 指针略离开列表时仍可命中，避免边缘落点因 1–2pt 偏差消失。
    static let hitTolerance: CGFloat = 18

    static func target(
        pointerY: CGFloat,
        pointerX: CGFloat? = nil,
        dragDirection: CategoryDragDirection,
        rows: [CategoryDragRowFrame],
        categoryIDs: [Int],
        movingCategoryID: Int,
        protecting protectedIDs: Set<Int>
    ) -> CategoryDragDropTarget? {
        guard
            !rows.isEmpty,
            Set(rows.map(\.categoryID)).count == rows.count,
            Set(categoryIDs).count == categoryIDs.count,
            !protectedIDs.contains(movingCategoryID),
            protectedIDs.isSubset(of: Set(categoryIDs)),
            let movingIndex = categoryIDs.firstIndex(of: movingCategoryID),
            let listMinX = rows.map(\.frame.minX).min(),
            let listMaxX = rows.map(\.frame.maxX).max(),
            let listMinY = rows.map(\.frame.minY).min(),
            let listMaxY = rows.map(\.frame.maxY).max(),
            (pointerX.map {
                $0 >= listMinX - Self.hitTolerance
                    && $0 <= listMaxX + Self.hitTolerance
            } ?? true),
            pointerY >= listMinY - Self.hitTolerance,
            pointerY <= listMaxY + Self.hitTolerance
        else {
            return nil
        }

        let movingProtectedDepth = categoryIDs[..<movingIndex]
            .filter(protectedIDs.contains)
            .count
        let legalRows = rows.filter { row in
            guard
                row.categoryID != movingCategoryID,
                !protectedIDs.contains(row.categoryID),
                let index = categoryIDs.firstIndex(of: row.categoryID)
            else {
                return false
            }
            let isInDragDirection: Bool
            switch dragDirection {
            case .upward:
                isInDragDirection = index < movingIndex
            case .downward:
                isInDragDirection = index > movingIndex
            }
            guard isInDragDirection else { return false }
            let protectedDepth = categoryIDs[..<index]
                .filter(protectedIDs.contains)
                .count
            return protectedDepth == movingProtectedDepth
        }
        guard let nearestRow = legalRows.min(by: {
            abs(pointerY - $0.frame.midY) < abs(pointerY - $1.frame.midY)
        }) else {
            return nil
        }
        guard
            let targetIndex = categoryIDs.firstIndex(of: nearestRow.categoryID),
            let reorderedIDs = CategoryOrdering.reorderedIDs(
                categoryIDs,
                moving: movingCategoryID,
                to: nearestRow.categoryID,
                protecting: protectedIDs
            ),
            reorderedIDs != categoryIDs
        else {
            return nil
        }

        return CategoryDragDropTarget(
            categoryID: nearestRow.categoryID,
            placement: targetIndex > movingIndex ? .after : .before
        )
    }
}

/// 分类拖拽的单一状态源；拖动过程只更新指针和目标，不提交目录。
struct CategoryDragState {
    static let activationDistance: CGFloat = 4
    /// 只有明确纵向拖动后才显示重排落点，避免点击附近时横线闪烁。
    static let reorderActivationDistance: CGFloat = 10

    private(set) var draggedCategoryID: Int?
    private(set) var originalCategoryIDs: [Int]?
    private(set) var translation: CGSize = .zero
    private(set) var dropTarget: CategoryDragDropTarget?

    var isDragging: Bool {
        draggedCategoryID != nil
    }

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
        originalCategoryIDs = categoryIDs
        translation = .zero
        dropTarget = nil
        return true
    }

    @discardableResult
    mutating func update(
        translation: CGSize,
        pointerY: CGFloat,
        pointerX: CGFloat? = nil,
        rows: [CategoryDragRowFrame],
        protecting protectedIDs: Set<Int>,
        canDrop: Bool
    ) -> Bool {
        guard
            canDrop,
            let draggedCategoryID,
            let originalCategoryIDs
        else {
            self.translation = translation
            dropTarget = nil
            return false
        }

        self.translation = translation
        guard abs(translation.height) >= Self.reorderActivationDistance else {
            dropTarget = nil
            return false
        }
        let dragDirection: CategoryDragDirection = translation.height < 0
            ? .upward
            : .downward
        dropTarget = CategoryDragGeometry.target(
            pointerY: pointerY,
            pointerX: pointerX,
            dragDirection: dragDirection,
            rows: rows,
            categoryIDs: originalCategoryIDs,
            movingCategoryID: draggedCategoryID,
            protecting: protectedIDs
        )
        return dropTarget != nil
    }

    /// 松手时只产出一个完整顺序；状态会在返回前清理，重复结束不会再次提交。
    @discardableResult
    mutating func finish(
        protecting protectedIDs: Set<Int>,
        canDrop: Bool,
        minimumDistance: CGFloat = CategoryDragState.activationDistance
    ) -> CategoryDragCommit? {
        defer { cancel() }
        guard
            canDrop,
            let draggedCategoryID,
            let originalCategoryIDs,
            let dropTarget,
            hypot(translation.width, translation.height) >= minimumDistance,
            let reorderedCategoryIDs = CategoryOrdering.reorderedIDs(
                originalCategoryIDs,
                moving: draggedCategoryID,
                to: dropTarget.categoryID,
                protecting: protectedIDs
            ),
            reorderedCategoryIDs != originalCategoryIDs
        else {
            return nil
        }

        return CategoryDragCommit(
            movingCategoryID: draggedCategoryID,
            targetCategoryID: dropTarget.categoryID,
            reorderedCategoryIDs: reorderedCategoryIDs
        )
    }

    mutating func cancel() {
        draggedCategoryID = nil
        originalCategoryIDs = nil
        translation = .zero
        dropTarget = nil
    }
}
