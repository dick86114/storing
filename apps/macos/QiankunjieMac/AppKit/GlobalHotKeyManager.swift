import AppKit
import Carbon.HIToolbox
import QiankunjieCollect

@MainActor
protocol HotKeyRegistering: AnyObject {
    @discardableResult
    func register(_ shortcut: GlobalShortcut) -> Bool
    func unregister()
}

private final class HotKeyCallbackBox: @unchecked Sendable {
    private let handler: @Sendable @MainActor () -> Void

    init(handler: @escaping @Sendable @MainActor () -> Void) {
        self.handler = handler
    }

    @MainActor func invoke() {
        handler()
    }
}

@MainActor
public final class GlobalHotKeyManager: HotKeyRegistering, @unchecked Sendable {
    private let callbackBox: HotKeyCallbackBox
    private let callbackPointer: UnsafeMutableRawPointer
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandlerRef: EventHandlerRef?
    private var currentShortcut: GlobalShortcut?

    private static let hotKeyPressedCallback: @convention(c) (
        EventHandlerCallRef?,
        EventRef?,
        UnsafeMutableRawPointer?
    ) -> OSStatus = { _, _, context in
        guard let context else { return OSStatus(paramErr) }
        let box = Unmanaged<HotKeyCallbackBox>.fromOpaque(context).takeUnretainedValue()
        Task { @MainActor in
            box.invoke()
        }
        return noErr
    }

    public init(handler: @escaping @Sendable @MainActor () -> Void) {
        let box = HotKeyCallbackBox(handler: handler)
        self.callbackBox = box
        self.callbackPointer = Unmanaged.passRetained(box).toOpaque()
    }

    @discardableResult
    func register(_ shortcut: GlobalShortcut) -> Bool {
        guard currentShortcut != shortcut else { return true }
        unregister()

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        var handlerRef: EventHandlerRef?
        let installResult = InstallEventHandler(
            GetApplicationEventTarget(),
            Self.hotKeyPressedCallback,
            1,
            &eventType,
            callbackPointer,
            &handlerRef
        )
        guard installResult == noErr else { return false }

        var keyRef: EventHotKeyRef?
        let registerResult = RegisterEventHotKey(
            shortcut.carbonKeyCode,
            shortcut.carbonModifiers,
            EventHotKeyID(signature: OSType(0x514A4B4A), id: 1),
            GetApplicationEventTarget(),
            0,
            &keyRef
        )
        guard registerResult == noErr, let keyRef else {
            if let handlerRef {
                RemoveEventHandler(handlerRef)
            }
            return false
        }

        eventHandlerRef = handlerRef
        hotKeyRef = keyRef
        currentShortcut = shortcut
        return true
    }

    func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        if let eventHandlerRef {
            RemoveEventHandler(eventHandlerRef)
            self.eventHandlerRef = nil
        }
        currentShortcut = nil
    }

    isolated deinit {
        if hotKeyRef != nil || eventHandlerRef != nil {
            unregister()
        }
        Unmanaged<HotKeyCallbackBox>.fromOpaque(callbackPointer).release()
    }
}
