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

    @Test func 发起用户变化会取消旧提交() {
        var state = CategoryQuickCreateSubmissionState(openedUserID: 9)
        guard let token = state.beginSubmission(currentUserID: 9) else {
            Issue.record("首次提交应获得令牌")
            return
        }

        #expect(state.isSubmitting)
        let 用户已变化 = state.userChanged(to: 10)
        #expect(用户已变化)
        #expect(!state.isSubmitting)
        let 迟到完成已生效 = state.completeSubmission(token: token, currentUserID: 10)
        #expect(!迟到完成已生效)
    }

    @Test func 提交中可以取消() {
        var state = CategoryQuickCreateSubmissionState(openedUserID: 9)
        _ = state.beginSubmission(currentUserID: 9)

        #expect(state.isSubmitting)
        state.cancelSubmission()

        #expect(!state.isSubmitting)
    }

    @Test func 取消后迟到完成不会改变新提交状态() {
        var state = CategoryQuickCreateSubmissionState(openedUserID: 9)
        guard let 旧令牌 = state.beginSubmission(currentUserID: 9) else {
            Issue.record("首次提交应获得令牌")
            return
        }
        state.cancelSubmission()
        let 新令牌 = state.beginSubmission(currentUserID: 9)

        guard let 新令牌 else {
            Issue.record("取消后应能开启新提交")
            return
        }

        let 旧完成已生效 = state.completeSubmission(token: 旧令牌, currentUserID: 9)
        #expect(!旧完成已生效)
        #expect(state.isSubmitting)
        let 新完成已生效 = state.completeSubmission(token: 新令牌, currentUserID: 9)
        #expect(新完成已生效)
        #expect(!state.isSubmitting)
    }

    @Test func 用户切换后新用户可以立即开始创建() {
        var 旧表单 = CategoryQuickCreateSubmissionState(openedUserID: 9)
        _ = 旧表单.beginSubmission(currentUserID: 9)
        let 用户已变化 = 旧表单.userChanged(to: 10)
        #expect(用户已变化)

        var 新表单 = CategoryQuickCreateSubmissionState(openedUserID: 10)
        let token = 新表单.beginSubmission(currentUserID: 10)

        #expect(token != nil)
        #expect(新表单.isSubmitting)
        let 旧表单新用户令牌 = 旧表单.beginSubmission(currentUserID: 10)
        #expect(旧表单新用户令牌 == nil)
    }
}
