import SwiftUI

public extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

public enum QiankunjieRadius {
    public static let control: CGFloat = 8
    public static let panel: CGFloat = 12
    public static let modal: CGFloat = 16
}

public enum QiankunjieColors {
    public static let lightAccent = Color(hex: 0xB86F54)
    public static let lightOnAccent = Color(hex: 0xFFFFFF)
    public static let lightAccentContainer = Color(hex: 0xF8E2DA)
    public static let lightOnAccentContainer = Color(hex: 0x452017)
    public static let lightInk = Color(hex: 0x0D2B1E)
    public static let lightOnInk = Color(hex: 0xFFFFFF)
    public static let lightInkContainer = Color(hex: 0xDCEDE3)
    public static let lightOnInkContainer = Color(hex: 0x001A10)
    public static let lightSecondary = Color(hex: 0x60786B)
    public static let lightSecondaryContainer = Color(hex: 0xE5EFE9)
    public static let lightOnSecondaryContainer = Color(hex: 0x17261C)
    public static let lightError = Color(hex: 0xD93025)
    public static let lightOnError = Color(hex: 0xFFFFFF)
    public static let lightErrorContainer = Color(hex: 0xFFDAD6)
    public static let lightOnErrorContainer = Color(hex: 0x410002)
    public static let lightBackground = Color(hex: 0xF3F7F3)
    public static let lightOnBackground = Color(hex: 0x1A2E24)
    public static let lightSurface = Color(hex: 0xFFFFFF)
    public static let lightOnSurface = Color(hex: 0x1A2E24)
    public static let lightSurfaceVariant = Color(hex: 0xEAF0EB)
    public static let lightOnSurfaceVariant = Color(hex: 0x5A7062)
    public static let lightOutline = Color(hex: 0xD5DED7)
    public static let lightOutlineVariant = Color(hex: 0xE5ECE7)
    public static let lightGlassBackdropStart = Color(hex: 0xF8FBF8)
    public static let lightGlassBackdropMiddle = Color(hex: 0xF2F6F2)
    public static let lightGlassBackdropEnd = Color(hex: 0xF7F4EC)

    public static let darkAccent = Color(hex: 0xC9A84C)
    public static let darkOnAccent = Color(hex: 0x071A12)
    public static let darkAccentContainer = Color(hex: 0x463A20)
    public static let darkOnAccentContainer = Color(hex: 0xFFE9A0)
    public static let darkInk = Color(hex: 0x8BAA94)
    public static let darkOnInk = Color(hex: 0x071A12)
    public static let darkInkContainer = Color(hex: 0x1C3A2B)
    public static let darkOnInkContainer = Color(hex: 0xC8E6D0)
    public static let darkSecondary = Color(hex: 0x9CA89F)
    public static let darkSecondaryContainer = Color(hex: 0x2A3A30)
    public static let darkOnSecondaryContainer = Color(hex: 0xB8CCBD)
    public static let darkError = Color(hex: 0xE74C3C)
    public static let darkOnError = Color(hex: 0x071A12)
    public static let darkErrorContainer = Color(hex: 0x4A2A28)
    public static let darkOnErrorContainer = Color(hex: 0xFFDAD6)
    public static let darkBackground = Color(hex: 0x071A12)
    public static let darkOnBackground = Color(hex: 0xE8E4DC)
    public static let darkSurface = Color(hex: 0x0E2419)
    public static let darkOnSurface = Color(hex: 0xE8E4DC)
    public static let darkSurfaceVariant = Color(hex: 0x0D2B1E)
    public static let darkOnSurfaceVariant = Color(hex: 0x9CA89F)
    public static let darkOutline = Color(hex: 0x1C3A2B)
    public static let darkOutlineVariant = Color(hex: 0x243D30)

    public static func accent(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkAccent : lightAccent
    }

    public static func background(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkBackground : lightBackground
    }

    public static func surface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkSurface : lightSurface
    }

    public static func surfaceVariant(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkSurfaceVariant : lightSurfaceVariant
    }

    public static func onBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkOnBackground : lightOnBackground
    }

    public static func onSurface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkOnSurface : lightOnSurface
    }

    public static func onSurfaceVariant(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkOnSurfaceVariant : lightOnSurfaceVariant
    }

    public static func outline(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? darkOutline : lightOutline
    }
}

public enum QiankunjieTypography {
    public static let headlineMedium = Font.system(.title, design: .default, weight: .semibold)
    public static let headlineSmall = Font.system(.title2, design: .default, weight: .semibold)
    public static let titleLarge = Font.system(.headline, design: .default, weight: .semibold)
    public static let titleMedium = Font.system(.subheadline, design: .default, weight: .semibold)
    public static let bodyLarge = Font.system(.body, design: .default)
    public static let bodyMedium = Font.system(.callout, design: .default)
    public static let labelLarge = Font.system(.callout, design: .default, weight: .semibold)
    public static let labelMedium = Font.system(.caption, design: .default, weight: .medium)
}

public struct QiankunjieTheme<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .fontDesign(.default)
            .tint(QiankunjieColors.accent(for: colorScheme))
            .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
    }
}
