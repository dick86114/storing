import Foundation
import QiankunjieCore
import Security

public actor KeychainSessionStore: SessionStore {
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

    public func save(_ tokens: SessionTokens) async throws {
        let data = Data(tokens.refreshToken.utf8)
        let updateAttributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let updateStatus = SecItemUpdate(baseQuery as CFDictionary, updateAttributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw AppError.server
        }

        var addQuery = baseQuery
        for (key, value) in updateAttributes {
            addQuery[key] = value
        }
        guard SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess else {
            throw AppError.server
        }
    }

    public func clear() async throws {
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
