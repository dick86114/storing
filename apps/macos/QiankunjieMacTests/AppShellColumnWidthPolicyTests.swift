import CoreGraphics
import Testing
@testable import QiankunjieMac

struct AppShellColumnWidthPolicyTests {
    @Test func 默认中栏保持适中() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(availableWidth: 2000)

        #expect(width.minimum == 340)
        #expect(width.ideal == 620)
    }

    @Test func 用户调整后的中栏宽度会作为下一次导航的初始宽度() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(availableWidth: 2000, overrideWidth: 760)

        #expect(width.minimum == 340)
        #expect(width.ideal == 760)
    }

    @Test func 窄三栏初始宽度不超过可用空间() {
        let policy = AppShellColumnWidthPolicy()

        let width = policy.contentColumnWidth(availableWidth: 900)

        #expect(width.minimum == 340)
        #expect(width.ideal == 580)
    }
}
