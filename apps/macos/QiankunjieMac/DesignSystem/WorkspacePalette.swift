import QiankunjieDesignSystem
import SwiftUI

enum WorkspacePalette {
    static func primary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x8FB8A0) : Color(hex: 0x0D2B1E)
    }

    static func primaryContainer(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x1C3A2B) : Color(hex: 0xDCEDE3)
    }

    static func onPrimary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x071A12) : .white
    }

    static func pageBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x071A12) : Color(hex: 0xF3F7F3)
    }

    static func sectionSurface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x0E2419) : .white
    }

    static func outline(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(hex: 0x24402F) : Color(hex: 0xD5DED7)
    }
}
