import SwiftUI
import Testing
@testable import QiankunjieAuth

@Suite("外观偏好")
struct AppearancePreferenceTests {
    @Test func 跟随系统不向窗口写入任何颜色方案偏好() {
        // 返回 nil 才能让 SwiftUI 撤销此前设置的强制外观、重新读取系统外观；
        // 如果返回当前环境里的颜色方案，切回“跟随系统”就会永远停留在上一次的强制外观。
        #expect(AppearancePreference.system.preferredColorScheme == nil)
    }

    @Test func 浅色与深色返回对应的强制颜色方案() {
        #expect(AppearancePreference.light.preferredColorScheme == .light)
        #expect(AppearancePreference.dark.preferredColorScheme == .dark)
    }

    @Test func 三种取值都带有可显示的名称() {
        #expect(AppearancePreference.allCases.map(\.displayName) == ["跟随系统", "浅色", "深色"])
    }
}
