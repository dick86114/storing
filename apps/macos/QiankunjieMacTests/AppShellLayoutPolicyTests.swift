import Testing
@testable import QiankunjieMac

struct AppShellLayoutPolicyTests {
    @Test func 宽度达到阈值时保持三栏() {
        let policy = AppShellLayoutPolicy(threeColumnMinimumWidth: 900)

        let layout = policy.layout(availableWidth: 900, selectedArticleID: nil)

        #expect(layout == .threeColumns)
    }

    @Test func 窄窗口未选择文章时列表优先() {
        let policy = AppShellLayoutPolicy(threeColumnMinimumWidth: 900)

        let layout = policy.layout(availableWidth: 899, selectedArticleID: nil)

        #expect(layout == .listDetail(isReaderPrimary: false))
    }

    @Test func 窄窗口选择文章后阅读区优先() {
        let policy = AppShellLayoutPolicy(threeColumnMinimumWidth: 900)

        let layout = policy.layout(availableWidth: 899, selectedArticleID: 42)

        #expect(layout == .listDetail(isReaderPrimary: true))
    }

    @Test func 设置类页面与历史任务都合并中栏和阅读栏() {
        let policy = AppShellLayoutPolicy(threeColumnMinimumWidth: 900)

        let wideLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .settings)
        let narrowLayout = policy.layout(availableWidth: 640, selectedArticleID: nil, destination: .settings)
        let adminLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .admin)
        let categoriesLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .categories)
        let historyLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .collectHistory)
        let narrowHistoryLayout = policy.layout(availableWidth: 640, selectedArticleID: nil, destination: .collectHistory)

        #expect(wideLayout == .settings)
        #expect(narrowLayout == .settings)
        #expect(adminLayout == .settings)
        #expect(categoriesLayout == .settings)
        // 历史任务页是「左列表 + 右正文」，跟随资料库的三栏/窄窗口策略。
        #expect(historyLayout == .threeColumns)
        #expect(narrowHistoryLayout == .listDetail(isReaderPrimary: false))
    }
}
