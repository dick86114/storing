import SwiftUI

public enum BrandAssetName: String, CaseIterable, Sendable {
    case brandLogo = "BrandLogo"
    case qiankunjieMark = "QiankunjieMark"
    case wechatSource = "WechatSource"
    case emptyLibraryLight = "EmptyLibraryLight"
    case emptyLibraryDark = "EmptyLibraryDark"

    public var image: Image {
        Image(rawValue, bundle: .main)
    }

    public var accessibilityLabel: String {
        switch self {
        case .brandLogo, .qiankunjieMark:
            "乾坤戒"
        case .wechatSource:
            "微信"
        case .emptyLibraryLight, .emptyLibraryDark:
            "资料库为空"
        }
    }
}

public struct ArticleCoverFallback: Hashable, Sendable {
    public let startHex: UInt32
    public let endHex: UInt32

    public init(startHex: UInt32, endHex: UInt32) {
        self.startHex = startHex
        self.endHex = endHex
    }

    public var startColor: Color {
        Color(hex: startHex)
    }

    public var endColor: Color {
        Color(hex: endHex)
    }

    public var gradient: LinearGradient {
        LinearGradient(
            colors: [startColor, endColor],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    public static let palettes: [ArticleCoverFallback] = [
        ArticleCoverFallback(startHex: 0xB64A3C, endHex: 0xF3B16D),
        ArticleCoverFallback(startHex: 0x3E6674, endHex: 0x8EC0B8),
        ArticleCoverFallback(startHex: 0x6A536E, endHex: 0xC6A6C8),
        ArticleCoverFallback(startHex: 0x78623A, endHex: 0xE2C783),
    ]

    public static func forArticle(_ articleId: Int) -> ArticleCoverFallback {
        let index = ((articleId % palettes.count) + palettes.count) % palettes.count
        return palettes[index]
    }
}
