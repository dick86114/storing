import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct CategoryQuickCreateResultTests {
    @Test func 采用现有分类不会生成创建成功提醒() {
        let 现有分类 = ArticleCategory(id: 2, name: "产品设计", sortOrder: 20)
        let 结果 = CategoryQuickCreateResult.reusedExisting(现有分类)

        #expect(结果.category == 现有分类)
        #expect(结果.creationNotice == nil)
    }

    @Test func 真正创建分类仍生成创建成功提醒() {
        let 新分类 = ArticleCategory(id: 3, name: "市场研究", sortOrder: 30)
        let 结果 = CategoryQuickCreateResult.created(新分类)

        #expect(结果.category == 新分类)
        #expect(结果.creationNotice == "分类「市场研究」已创建")
    }
}
