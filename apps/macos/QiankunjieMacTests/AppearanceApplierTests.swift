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
}
