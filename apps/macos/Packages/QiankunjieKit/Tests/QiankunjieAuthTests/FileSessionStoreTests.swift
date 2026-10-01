import Foundation
import Testing
@testable import QiankunjieAuth

@Suite("文件会话存储")
struct FileSessionStoreTests {
    private func temporaryFileURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("file-session-store-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("session.json", isDirectory: false)
    }

    @Test func 保存后可读取刷新令牌() async throws {
        let fileURL = temporaryFileURL()
        let store = FileSessionStore(fileURL: fileURL)

        try await store.save(SessionTokens(accessToken: "ignored", refreshToken: "refresh-token"))

        let tokens = try await store.read()
        #expect(tokens?.refreshToken == "refresh-token")
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
    }

    @Test func 清除后读取为空() async throws {
        let fileURL = temporaryFileURL()
        let store = FileSessionStore(fileURL: fileURL)
        try await store.save(SessionTokens(accessToken: "", refreshToken: "refresh-token"))

        try await store.clear()

        #expect(try await store.read() == nil)
        #expect(!FileManager.default.fileExists(atPath: fileURL.path))
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
    }

    @Test func 文件损坏时视为无会话且不抛错() async throws {
        let fileURL = temporaryFileURL()
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try "{ 不是合法 JSON".data(using: .utf8)?.write(to: fileURL)
        let store = FileSessionStore(fileURL: fileURL)

        #expect(try await store.read() == nil)
        #expect(!FileManager.default.fileExists(atPath: fileURL.path))
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
    }

    @Test func 保存后文件权限仅当前用户可读写() async throws {
        let fileURL = temporaryFileURL()
        let store = FileSessionStore(fileURL: fileURL)
        try await store.save(SessionTokens(accessToken: "", refreshToken: "refresh-token"))

        let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
        let permissions = attributes[.posixPermissions] as? NSNumber
        #expect(permissions?.intValue == 0o600)
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
    }
}
