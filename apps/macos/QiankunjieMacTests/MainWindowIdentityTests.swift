import AppKit
import Testing
@testable import QiankunjieMac

@MainActor
@Suite("主窗口身份")
struct MainWindowIdentityTests {
    @Test func 主窗口注册后禁止标签页并优先复用() {
        let window = NSWindow(
            contentRect: .zero,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )

        MainWindowIdentity.configure(window)

        #expect(window.tabbingMode == .disallowed)
        #expect(MainWindowIdentity.existingWindow(in: []) === window)
    }
}
