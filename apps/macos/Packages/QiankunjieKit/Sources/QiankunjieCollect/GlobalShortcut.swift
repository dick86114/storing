import Carbon.HIToolbox
import Foundation

public enum GlobalShortcut: String, CaseIterable, Identifiable, Sendable {
    case optionCommandS
    case shiftCommandS
    case controlOptionS

    public static let `default` = optionCommandS

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .optionCommandS: "⌥⌘S"
        case .shiftCommandS: "⇧⌘S"
        case .controlOptionS: "⌃⌥S"
        }
    }

    public var commandKey: String {
        switch self {
        case .optionCommandS, .shiftCommandS, .controlOptionS: "s"
        }
    }

    public var carbonKeyCode: UInt32 {
        UInt32(kVK_ANSI_S)
    }

    public var carbonModifiers: UInt32 {
        switch self {
        case .optionCommandS:
            UInt32(optionKey | cmdKey)
        case .shiftCommandS:
            UInt32(shiftKey)
        case .controlOptionS:
            UInt32(controlKey | optionKey)
        }
    }
}
