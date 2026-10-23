import Foundation

/// 分类拖拽排序的纯计算；系统分类始终固定，不参与移动或作为落点。
enum CategoryOrdering {
    static func reorderedIDs(
        _ categoryIDs: [Int],
        moving movingID: Int,
        to targetID: Int,
        protecting protectedIDs: Set<Int> = []
    ) -> [Int]? {
        guard movingID != targetID else { return nil }
        guard !protectedIDs.contains(movingID), !protectedIDs.contains(targetID) else {
            return nil
        }
        guard Set(categoryIDs).count == categoryIDs.count else { return nil }
        guard protectedIDs.isSubset(of: Set(categoryIDs)) else { return nil }
        guard
            let sourceIndex = categoryIDs.firstIndex(of: movingID),
            let targetIndex = categoryIDs.firstIndex(of: targetID)
        else {
            return nil
        }

        var result = categoryIDs
        let movingID = result.remove(at: sourceIndex)
        result.insert(movingID, at: min(targetIndex, result.endIndex))

        // 拖拽只能调整同一受保护区间内的用户分类，系统分类的绝对位置必须保持不变。
        for protectedID in protectedIDs {
            guard categoryIDs.firstIndex(of: protectedID) == result.firstIndex(of: protectedID) else {
                return nil
            }
        }
        return result
    }
}
