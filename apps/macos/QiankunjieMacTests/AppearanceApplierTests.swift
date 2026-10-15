import AppKit
import QiankunjieAuth
import Testing
@testable import QiankunjieMac

@MainActor
@Suite("外观应用")
struct AppearanceApplierTests {
    @Test func 跟随系统映射为空外观() {
        #expect(AppearancePreference.system.appKitAppearance == nil)
    }

    @Test func 浅色与深色映射到对应的AppKit外观() {
        #expect(AppearancePreference.light.appKitAppearance?.name == .aqua)
        #expect(AppearancePreference.dark.appKitAppearance?.name == .darkAqua)
    }

    @Test func 应用外观会同步到整个应用并能撤回() {
        AppearanceApplier.apply(.dark)
        #expect(NSApp.appearance?.name == .darkAqua)

        AppearanceApplier.apply(.light)
        #expect(NSApp.appearance?.name == .aqua)

        // 跟随系统必须把强制外观清空，否则会停留在上一次的深/浅色。
        AppearanceApplier.apply(.system)
        #expect(NSApp.appearance == nil)
    }

    @Test func 切回跟随系统会解析当前系统外观() {
        AppearanceApplier.apply(.system)
        let resolved = AppearanceApplier.resolvedWindowAppearance(for: .system)
        #expect(resolved?.name == NSApp.effectiveAppearance.name)
    }

    @Test func 外观同步不冻结菜单栏图标窗口() {
        AppearanceApplier.apply(.system)
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        defer {
            NSStatusBar.system.removeStatusItem(statusItem)
            AppearanceApplier.apply(.system)
        }

        guard let statusBarWindow = statusItem.button?.window else {
            Issue.record("状态栏图标应拥有 NSStatusBarWindow")
            return
        }

        // 系统负责让状态栏窗口跟随真实菜单栏外观；手动写入会把模板图标
        // 冻结在写入瞬间的系统深浅色上，之后切换系统主题就可能反色失效。
        statusBarWindow.appearance = nil
        AppearanceApplier.apply(.light)
        #expect(statusBarWindow.appearance == nil)
    }
}
