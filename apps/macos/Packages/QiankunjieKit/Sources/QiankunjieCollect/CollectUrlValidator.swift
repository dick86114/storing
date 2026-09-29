import Foundation
import QiankunjieCore

public enum CollectUrlValidator {
    public static func validate(_ input: String) throws -> URL {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmed.isEmpty,
            let url = URL(string: trimmed),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https",
            let rawHost = url.host?.lowercased(),
            !rawHost.isEmpty,
            url.user == nil,
            url.password == nil
        else {
            throw AppError.invalidInput
        }

        let host = rawHost.hasPrefix("[") && rawHost.hasSuffix("]")
            ? String(rawHost.dropFirst().dropLast())
            : rawHost

        guard !isLocalOrPrivateHost(host) else {
            throw AppError.invalidInput
        }

        return url
    }

    private static func isLocalOrPrivateHost(_ host: String) -> Bool {
        if let address = IPv4Address(host) {
            return address.isLocalOrPrivate
        }
        if let address = IPv6Address(host) {
            return address.isLocalOrPrivate
        }

        return host == "localhost"
            || host.hasSuffix(".localhost")
            || host.hasSuffix(".local")
            || host.hasSuffix(".internal")
            || host.hasSuffix(".home.arpa")
            || !host.contains(".")
    }
}

private struct IPv4Address {
    private let value: in_addr_t

    init?(_ text: String) {
        var address = in_addr()
        guard inet_pton(AF_INET, text, &address) == 1 else { return nil }
        value = address.s_addr
    }

    var isLocalOrPrivate: Bool {
        let octets = Array(withUnsafeBytes(of: value) { Data($0) })

        return octets[0] == 0
            || octets[0] == 10
            || octets[0] == 127
            || (octets[0] == 100 && (octets[1] & 0xC0) == 64)
            || (octets[0] == 169 && octets[1] == 254)
            || (octets[0] == 172 && (octets[1] & 0xF0) == 16)
            || (octets[0] == 192 && octets[1] == 168)
            || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
            || octets[0] >= 224
    }
}

private struct IPv6Address {
    private let octets: [UInt8]

    init?(_ text: String) {
        var address = in6_addr()
        guard inet_pton(AF_INET6, text, &address) == 1 else { return nil }
        octets = withUnsafeBytes(of: address) { Array($0) }
    }

    var isLocalOrPrivate: Bool {
        let bytes = octets
        let first = bytes[0]
        let second = bytes[1]

        let isIPv4Mapped = bytes.prefix(10).allSatisfy { $0 == 0 }
            && bytes[10] == 0xFF
            && bytes[11] == 0xFF
        let mappedIPv4 = Array(bytes.suffix(4))

        return bytes.allSatisfy { $0 == 0 }
            || (isIPv4Mapped && Self.isPrivateIPv4(mappedIPv4))
            || first == 0x7F
            || (first == 0xFE && (second & 0xC0) == 0x80)
            || (first & 0xFE) == 0xFC
            || (first == 0x20 && second == 0x01 && bytes[2] == 0xDB && bytes[3] == 0x80)
    }

    private static func isPrivateIPv4(_ octets: [UInt8]) -> Bool {
        guard octets.count == 4 else { return false }

        return octets[0] == 0
            || octets[0] == 10
            || octets[0] == 127
            || (octets[0] == 100 && (octets[1] & 0xC0) == 64)
            || (octets[0] == 169 && octets[1] == 254)
            || (octets[0] == 172 && (octets[1] & 0xF0) == 16)
            || (octets[0] == 192 && octets[1] == 168)
            || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
            || octets[0] >= 224
    }
}
