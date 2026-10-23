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
}
