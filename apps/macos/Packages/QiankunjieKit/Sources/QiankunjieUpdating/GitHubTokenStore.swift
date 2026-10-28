import Foundation

/// GitHub 令牌的最小校验与展示规则。
public enum GitHubTokenRules {
    public static func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmed.isEmpty,
            trimmed.count <= 512,
            trimmed.unicodeScalars.allSatisfy({
                $0.isASCII && !CharacterSet.whitespacesAndNewlines.contains($0)
            })
        else {
            return nil
        }
        return trimmed
    }

    public static func masked(_ value: String) -> String {
        guard let token = normalized(value), token.count > 8 else {
            return "••••"
        }
        return "\(token.prefix(4))…\(token.suffix(4))"
    }
}

public protocol GitHubTokenStoring: Sendable {
    func readGitHubToken() async -> String?
    func saveGitHubToken(_ token: String) async throws
    func clearGitHubToken() async throws
}

/// 文件型 GitHub 令牌存储。
///
/// 与登录会话保持一致，使用仅当前用户可读写的 0600 文件，避免无稳定签名时
/// Keychain 在每次重新打包后弹出授权。令牌只保存于本机。
public actor GitHubTokenStore: GitHubTokenStoring {
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
                .appendingPathComponent("github-update-token.json", isDirectory: false)
        }
    }

    public func readGitHubToken() async -> String? {
        guard let data = try? Data(contentsOf: fileURL) else {
            return nil
        }
        guard
            let stored = try? JSONDecoder().decode(StoredToken.self, from: data),
            let token = GitHubTokenRules.normalized(stored.token)
        else {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
        return token
    }

    public func saveGitHubToken(_ token: String) async throws {
        guard let normalized = GitHubTokenRules.normalized(token) else {
            throw GitHubTokenStoreError.invalidToken
        }

        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let data = try JSONEncoder().encode(StoredToken(token: normalized))
        try data.write(to: fileURL, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    public func clearGitHubToken() async throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return
        }
        try FileManager.default.removeItem(at: fileURL)
    }

    private struct StoredToken: Codable {
        let token: String
    }
}

public enum GitHubTokenStoreError: Error, Equatable, Sendable {
    case invalidToken
}
