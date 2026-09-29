import SwiftUI

public enum LiquidGlassRole: CaseIterable, Sendable {
    case panel
    case chrome
    case control
    case accent
}

public struct LiquidGlassTokens: Equatable, Sendable {
    public let surfaceOpacity: Double
    public let borderOpacity: Double
    public let highlightOpacity: Double
    public let shadowOpacity: Double
    public let shadowRadius: CGFloat

    public init(
        surfaceOpacity: Double,
        borderOpacity: Double,
        highlightOpacity: Double,
        shadowOpacity: Double,
        shadowRadius: CGFloat
    ) {
        self.surfaceOpacity = surfaceOpacity
        self.borderOpacity = borderOpacity
        self.highlightOpacity = highlightOpacity
        self.shadowOpacity = shadowOpacity
        self.shadowRadius = shadowRadius
    }
}

public extension LiquidGlassRole {
    func tokens(for colorScheme: ColorScheme) -> LiquidGlassTokens {
        guard colorScheme == .light else {
            return LiquidGlassTokens(
                surfaceOpacity: 1,
                borderOpacity: 0.4,
                highlightOpacity: 0,
                shadowOpacity: 0,
                shadowRadius: 0
            )
        }

        return switch self {
        case .panel:
            LiquidGlassTokens(
                surfaceOpacity: 0.82,
                borderOpacity: 0.72,
                highlightOpacity: 0.92,
                shadowOpacity: 0.12,
                shadowRadius: 0
            )
        case .chrome:
            LiquidGlassTokens(
                surfaceOpacity: 0.88,
                borderOpacity: 0.80,
                highlightOpacity: 0.96,
                shadowOpacity: 0.16,
                shadowRadius: 16
            )
        case .control:
            LiquidGlassTokens(
                surfaceOpacity: 0.68,
                borderOpacity: 0.74,
                highlightOpacity: 0.92,
                shadowOpacity: 0.10,
                shadowRadius: 4
            )
        case .accent:
            LiquidGlassTokens(
                surfaceOpacity: 0.84,
                borderOpacity: 0.66,
                highlightOpacity: 0.96,
                shadowOpacity: 0.18,
                shadowRadius: 12
            )
        }
    }
}

public struct GlassSurface<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme

    private let role: LiquidGlassRole
    private let cornerRadius: CGFloat
    private let tint: Color?
    private let content: Content

    public init(
        role: LiquidGlassRole = .panel,
        cornerRadius: CGFloat = QiankunjieRadius.panel,
        tint: Color? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.role = role
        self.cornerRadius = cornerRadius
        self.tint = tint
        self.content = content()
    }

    public var body: some View {
        let tokens = role.tokens(for: colorScheme)
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        let surface = tint ?? QiankunjieColors.surface(for: colorScheme)
        let border = colorScheme == .dark
            ? QiankunjieColors.outline(for: colorScheme).opacity(tokens.borderOpacity)
            : Color.white.opacity(tokens.borderOpacity)

        content
            .background {
                if colorScheme == .dark {
                    shape.fill(surface.opacity(tokens.surfaceOpacity))
                } else {
                    shape.fill(.thinMaterial)
                    shape.fill(surface.opacity(tokens.surfaceOpacity))
                }
            }
            .overlay {
                shape.strokeBorder(border, lineWidth: 0.8)
            }
            .clipShape(shape)
            .shadow(
                color: shadowColor.opacity(tokens.shadowOpacity),
                radius: tokens.shadowRadius,
                y: tokens.shadowRadius > 0 ? 3 : 0
            )
    }

    private var shadowColor: Color {
        colorScheme == .dark ? .black : Color(hex: 0x173B2B)
    }
}
