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

    @Test func 设置和管理员设置都合并中栏和阅读栏() {
        let policy = AppShellLayoutPolicy(threeColumnMinimumWidth: 900)

        let wideLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .settings)
        let narrowLayout = policy.layout(availableWidth: 640, selectedArticleID: nil, destination: .settings)
        let adminLayout = policy.layout(availableWidth: 1000, selectedArticleID: nil, destination: .admin)

        #expect(wideLayout == .settings)
        #expect(narrowLayout == .settings)
        #expect(adminLayout == .settings)
    }
}
