import Testing
@testable import QiankunjieMac

struct CategoryOrderingTests {
    @Test func 分类拖拽向下移动时移动到目标之后() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3, 4],
                moving: 2,
                to: 4,
                protecting: [1]
            ) == [1, 3, 4, 2]
        )
    }

    @Test func 分类拖拽向上移动时移动到目标之前() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3, 4],
                moving: 4,
                to: 2,
                protecting: [1]
            ) == [1, 4, 2, 3]
        )
    }

    @Test func 系统分类不能被拖动也不能成为落点() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 1,
                to: 3,
                protecting: [1]
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 3,
                to: 1,
                protecting: [1]
            ) == nil
        )
    }

    @Test func 用户分类不能跨过中间的系统分类() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 1,
                to: 3,
                protecting: [2]
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 3,
                to: 1,
                protecting: [2]
            ) == nil
        )
    }

    @Test func 多个系统分类在用户分类移动后仍保持原位置() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3, 4, 5],
                moving: 1,
                to: 3,
                protecting: [2, 4]
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3, 4, 5],
                moving: 5,
                to: 3,
                protecting: [2, 4]
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3, 4, 5, 6],
                moving: 4,
                to: 3,
                protecting: [2, 5]
            ) == [1, 2, 4, 3, 5, 6]
        )
    }

    @Test func 不存在或重复的分类顺序不会生成排序结果() {
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 99,
                to: 2
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 1, 2, 3],
                moving: 1,
                to: 3
            ) == nil
        )
        #expect(
            CategoryOrdering.reorderedIDs(
                [1, 2, 3],
                moving: 1,
                to: 2,
                protecting: [99]
            ) == nil
        )
    }
}
