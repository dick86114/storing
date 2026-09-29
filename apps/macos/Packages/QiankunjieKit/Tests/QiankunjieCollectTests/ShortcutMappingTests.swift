import Testing
@testable import QiankunjieCollect

struct ShortcutMappingTests {
    @Test func globalShortcutMappingSupportsApprovedChoices() {
        #expect(GlobalShortcut.default.commandKey == "s")
        #expect(GlobalShortcut.allCases.map(\.displayName) == ["⌥⌘S", "⇧⌘S", "⌃⌥S"])
    }
}
