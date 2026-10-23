import Testing
@testable import QiankunjieMac

struct CategoryQuickCreatePolicyTests {
    @Test func 分类名称会去除首尾空白并按非空校验() {
        #expect(CategoryQuickCreatePolicy.normalizedName("  产品设计\n") == "产品设计")
        #expect(!CategoryQuickCreatePolicy.canSubmit(name: " \n ", isSubmitting: false))
        #expect(CategoryQuickCreatePolicy.canSubmit(name: " 产品设计 ", isSubmitting: false))
        #expect(!CategoryQuickCreatePolicy.canSubmit(name: "产品设计", isSubmitting: true))
    }

    @Test func 相同名称稳定得到相同颜色() {
        let 第一次 = CategoryQuickCreatePolicy.suggestedColor(
            for: "产品设计",
            existingColors: []
        )
        let 第二次 = CategoryQuickCreatePolicy.suggestedColor(
            for: " 产品设计 ",
            existingColors: []
        )

        #expect(第一次 == 第二次)
        #expect(categoryPresetColors.contains(第一次))
    }

    @Test func 可选颜色会避开已使用颜色() {
        let 已使用 = CategoryQuickCreatePolicy.suggestedColor(
            for: "产品设计",
            existingColors: []
        )
        let 实际颜色 = CategoryQuickCreatePolicy.suggestedColor(
            for: "产品设计",
            existingColors: [已使用]
        )

        #expect(实际颜色 != 已使用)
        #expect(categoryPresetColors.contains(实际颜色))
    }
}
