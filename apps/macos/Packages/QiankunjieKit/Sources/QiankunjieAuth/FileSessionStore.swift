import Foundation

/// 文件型会话存储。
///
/// 当前 macOS 分发版本没有稳定的 Developer ID 签名，每次重新打包后
/// Keychain 都会把新版本视为不同应用并弹出授权对话框。这里把刷新令牌
/// 改存到用户目录下的普通文件，避免每次启动都要求输入钥匙串密码。
/// 文件权限固定为 0600，仅当前用户可读写。
public actor FileSessionStore: SessionStore {
    private let fileURL: URL

    public init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
        } else {
            let supportDirectory = FileManager.default
                .urls(for: .applicationSupportDirectory, in: .userDomainMask)
                .first ?? FileManager.default.temporaryDirectory
            let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.idickies.storing.macos"
            self.fileURL = supportDirectory
                .appendingPathComponent(bundleIdentifier, isDirectory: true)
                .appendingPathComponent("session.json", isDirectory: false)
        }
    }

    public func read() async throws -> SessionTokens? {
        guard let data = try? Data(contentsOf: fileURL) else {
            return nil
        }
        guard let stored = try? JSONDecoder().decode(StoredSession.self, from: data) else {
            // 文件损坏时直接丢弃，让用户重新登录，避免应用无法启动。
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
        guard !stored.refreshToken.isEmpty else {
            return nil
        }
        return SessionTokens(accessToken: "", refreshToken: stored.refreshToken)
    }

    public func save(_ tokens: SessionTokens) async throws {
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )

        let data = try JSONEncoder().encode(StoredSession(refreshToken: tokens.refreshToken))
        try data.write(to: fileURL, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    public func clear() async throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return
        }
        try FileManager.default.removeItem(at: fileURL)
    }

    private struct StoredSession: Codable {
        let refreshToken: String
    }
}
