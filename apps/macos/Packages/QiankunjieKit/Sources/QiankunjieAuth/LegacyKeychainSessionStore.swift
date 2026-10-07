import Foundation
import QiankunjieCore
import Security

/// 只读旧 Keychain 令牌，用于从历史版本迁移到文件存储。
/// 新代码禁止通过该类型写入钥匙串。
public actor LegacyKeychainSessionStore: LegacySessionStore {
    private let service: String
    private let account: String

    public init(
        service: String = "com.idickies.storing.macos",
        account: String = "refresh-token"
    ) {
        self.service = service
        self.account = account
    }

    public func read() async throws -> SessionTokens? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw AppError.server
        }
        guard
            let data = item as? Data,
            let refreshToken = String(data: data, encoding: .utf8)
        else {
            throw AppError.server
        }
        return SessionTokens(accessToken: "", refreshToken: refreshToken)
    }

    public func clearLegacy() async throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw AppError.server
        }
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
