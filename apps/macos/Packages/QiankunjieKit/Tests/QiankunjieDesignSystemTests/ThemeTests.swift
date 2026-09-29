import SwiftUI
import Testing
@testable import QiankunjieDesignSystem

@Test func 主题使用已批准的澄明书斋色值() {
    #expect(QiankunjieColors.lightBackground == Color(hex: 0xF3F7F3))
    #expect(QiankunjieColors.lightAccent == Color(hex: 0xB86F54))
    #expect(QiankunjieColors.darkBackground == Color(hex: 0x071A12))
    #expect(QiankunjieColors.darkAccent == Color(hex: 0xC9A84C))
}

@Test func 玻璃角色保持Android语义顺序() {
    #expect(LiquidGlassRole.allCases == [.panel, .chrome, .control, .accent])
}

@Test func 圆角令牌固定为八十二和十六点() {
    #expect(QiankunjieRadius.control == 8)
    #expect(QiankunjieRadius.panel == 12)
    #expect(QiankunjieRadius.modal == 16)
}

@Test func 文章封面回退色保持Android四组配色并稳定循环() {
    #expect(ArticleCoverFallback.forArticle(0) == ArticleCoverFallback(startHex: 0xB64A3C, endHex: 0xF3B16D))
    #expect(ArticleCoverFallback.forArticle(1) == ArticleCoverFallback(startHex: 0x3E6674, endHex: 0x8EC0B8))
    #expect(ArticleCoverFallback.forArticle(2) == ArticleCoverFallback(startHex: 0x6A536E, endHex: 0xC6A6C8))
    #expect(ArticleCoverFallback.forArticle(-1) == ArticleCoverFallback(startHex: 0x78623A, endHex: 0xE2C783))
}

@Test func 品牌资源名称与Android迁移文件一一对应() {
    #expect(BrandAssetName.allCases.map(\.rawValue) == [
        "BrandLogo",
        "QiankunjieMark",
        "WechatSource",
        "EmptyLibraryLight",
        "EmptyLibraryDark",
    ])
}
