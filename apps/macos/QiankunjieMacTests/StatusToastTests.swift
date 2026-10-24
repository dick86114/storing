import Foundation
import Testing

struct StatusToastTests {
    @Test func 弱提醒胶囊和浮层不参与命中测试() throws {
        let source = try String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .appending(path: "../QiankunjieMac/DesignSystem/StatusToast.swift"),
            encoding: .utf8
        )

        #expect(source.components(separatedBy: ".allowsHitTesting(false)").count - 1 >= 2)
    }
}
