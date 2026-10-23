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
        guard
            let sourceIndex = categoryIDs.firstIndex(of: movingID),
            let targetIndex = categoryIDs.firstIndex(of: targetID)
        else {
            return nil
        }

        var result = categoryIDs
        let movingID = result.remove(at: sourceIndex)
        result.insert(movingID, at: min(targetIndex, result.endIndex))
        return result
    }
}
