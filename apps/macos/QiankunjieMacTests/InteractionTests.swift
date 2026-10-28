import AppKit
import Testing
@testable import QiankunjieMac

struct InteractionTests {
    @Test func 可点击控件识别按钮链接和禁用状态() {
        #expect(InteractiveAccessibilityRole.isClickable(
            role: NSAccessibility.Role.button.rawValue,
            actions: [NSAccessibility.Action.press.rawValue],
            isEnabled: true
        ))
        #expect(InteractiveAccessibilityRole.isClickable(
            role: NSAccessibility.Role.link.rawValue,
            actions: [],
            isEnabled: true
        ))
        #expect(!InteractiveAccessibilityRole.isClickable(
            role: NSAccessibility.Role.button.rawValue,
            actions: [NSAccessibility.Action.press.rawValue],
            isEnabled: false
        ))
        #expect(!InteractiveAccessibilityRole.isClickable(
            role: NSAccessibility.Role.group.rawValue,
            actions: [],
            isEnabled: true
        ))
    }

    @Test func 全应用统一点击样式并启用交互协调器() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceRoot = repositoryRoot.appendingPathComponent("QiankunjieMac")
        let files = try FileManager.default.subpathsOfDirectory(atPath: sourceRoot.path)
            .filter { $0.hasSuffix(".swift") }

        var plainButtonFiles: [String] = []
        for relativePath in files {
            let source = try String(
                contentsOf: sourceRoot.appendingPathComponent(relativePath),
                encoding: .utf8
            )
            if source.contains(".buttonStyle(.plain)") {
                plainButtonFiles.append(relativePath)
            }
        }

        let app = try String(
            contentsOf: sourceRoot.appendingPathComponent("App/QiankunjieApp.swift"),
            encoding: .utf8
        )
        let interaction = try String(
            contentsOf: sourceRoot.appendingPathComponent("DesignSystem/Interaction.swift"),
            encoding: .utf8
        )

        #expect(plainButtonFiles.isEmpty)
        #expect(app.contains("AppInteractionCoordinator.shared.start()"))
        #expect(app.contains("AppInteractionCoordinator.shared.stop()"))
        #expect(interaction.contains("window.acceptsMouseMovedEvents = true"))
    }
}
