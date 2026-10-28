import AppKit
import SwiftUI

/// 应用内统一的轻量交互动效。
/// 只放大很小的比例，避免侧栏行、文章卡片这类大面积控件在悬停时产生明显位移。
struct QiankunjiePlainButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        QiankunjieInteractiveSurface(
            isPressed: configuration.isPressed,
            isEnabled: isEnabled
        ) {
            configuration.label
        }
    }
}

private struct QiankunjieInteractiveSurface<Content: View>: View {
    let isPressed: Bool
    let isEnabled: Bool
    @ViewBuilder let content: () -> Content
    @State private var isHovering = false

    var body: some View {
        content()
            .scaleEffect(scale)
            .brightness(isHovering && isEnabled ? 0.025 : 0)
            .animation(.easeOut(duration: 0.12), value: isHovering)
            .animation(.easeOut(duration: 0.08), value: isPressed)
            .onHover { hovering in
                isHovering = hovering
            }
    }

    private var scale: CGFloat {
        guard isEnabled else { return 1 }
        if isPressed {
            return 0.994
        }
        return isHovering ? 1.003 : 1
    }
}

private struct QiankunjieInteractiveHoverModifier: ViewModifier {
    @Environment(\.isEnabled) private var isEnabled
    let isActive: Bool
    @State private var isHovering = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isHovering && isEnabled && isActive ? 1.003 : 1)
            .brightness(isHovering && isEnabled && isActive ? 0.025 : 0)
            .animation(.easeOut(duration: 0.12), value: isHovering)
            .onHover { hovering in
                isHovering = hovering
            }
    }
}

extension View {
    /// 给自定义 `onTapGesture` 区域补充与普通按钮一致的悬停反馈。
    func qiankunjieInteractiveHover(isActive: Bool = true) -> some View {
        modifier(QiankunjieInteractiveHoverModifier(isActive: isActive))
    }
}

enum InteractiveAccessibilityRole {
    static let clickableRoles: Set<String> = [
        NSAccessibility.Role.button.rawValue,
        NSAccessibility.Role.checkBox.rawValue,
        NSAccessibility.Role.colorWell.rawValue,
        NSAccessibility.Role.comboBox.rawValue,
        NSAccessibility.Role.disclosureTriangle.rawValue,
        NSAccessibility.Role.link.rawValue,
        NSAccessibility.Role.menuButton.rawValue,
        NSAccessibility.Role.menuItem.rawValue,
        NSAccessibility.Role.popUpButton.rawValue,
        NSAccessibility.Role.radioButton.rawValue,
    ]

    static func isClickable(
        role: String?,
        actions: [String],
        isEnabled: Bool
    ) -> Bool {
        guard isEnabled else { return false }
        if actions.contains(NSAccessibility.Action.press.rawValue) {
            return true
        }
        guard let role else { return false }
        return clickableRoles.contains(role)
    }
}

/// 统一处理全应用的手型光标与点击反馈，避免每个按钮单独维护光标状态。
@MainActor
final class AppInteractionCoordinator {
    static let shared = AppInteractionCoordinator()

    private var eventMonitor: Any?
    private var observers: [NSObjectProtocol] = []
    private var isHandCursorActive = false
    private var lastPointerRefreshTime: TimeInterval = 0
    private var pendingPointerRefresh: DispatchWorkItem?
    private weak var pendingPointerWindow: NSWindow?
    private var pendingPointerLocation = NSPoint.zero

    private init() {}

    func start() {
        guard eventMonitor == nil else { return }

        enableMouseMovedEventsForAllWindows()

        eventMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [
                .mouseMoved,
                .leftMouseDown,
                .rightMouseDown,
                .otherMouseDown,
                .mouseEntered,
                .mouseExited,
                .cursorUpdate,
                .scrollWheel,
            ]
        ) { [weak self] event in
            MainActor.assumeIsolated {
                self?.handle(event)
            }
            return event
        }

        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: NSApplication.didResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.resetCursor()
            }
        })
        observers.append(center.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.refreshAtCurrentMouseLocation()
            }
        })
        observers.append(center.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.enableMouseMovedEventsForAllWindows()
                self?.refreshAtCurrentMouseLocation()
            }
        })
    }

    func stop() {
        if let eventMonitor {
            NSEvent.removeMonitor(eventMonitor)
            self.eventMonitor = nil
        }
        observers.forEach(NotificationCenter.default.removeObserver)
        observers.removeAll()
        pendingPointerRefresh?.cancel()
        pendingPointerRefresh = nil
        pendingPointerWindow = nil
        pendingPointerLocation = .zero
        lastPointerRefreshTime = 0
        resetCursor()
    }

    func playClickFeedback(in window: NSWindow?, event: NSEvent) {
        guard let window else { return }
        InteractiveClickFeedbackView.play(in: window, at: event.locationInWindow)
    }

    private func handle(_ event: NSEvent) {
        guard let window = event.window, window.isVisible else {
            resetCursorIfNeeded()
            return
        }

        if event.type == .mouseExited {
            resetCursorIfNeeded()
            return
        }

        if event.type == .leftMouseDown {
            let clickable = isClickable(at: event.locationInWindow, in: window)
            updateCursor(isClickable: clickable)
            guard clickable else { return }
            playClickFeedback(in: window, event: event)
            return
        }

        schedulePointerRefresh(
            at: event.locationInWindow,
            in: window,
            immediately: event.type == .cursorUpdate
        )
    }

    private func refreshAtCurrentMouseLocation() {
        guard let window = NSApp.keyWindow ?? NSApp.mainWindow else {
            resetCursorIfNeeded()
            return
        }
        let point = window.convertPoint(fromScreen: NSEvent.mouseLocation)
        let event = NSEvent.mouseEvent(
            with: .mouseMoved,
            location: point,
            modifierFlags: [],
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: 0,
            pressure: 0
        )
        if let event {
            handle(event)
        }
    }

    private func enableMouseMovedEventsForAllWindows() {
        NSApp.windows.forEach { window in
            window.acceptsMouseMovedEvents = true
        }
    }

    private func schedulePointerRefresh(
        at windowPoint: NSPoint,
        in window: NSWindow,
        immediately: Bool
    ) {
        pendingPointerWindow = window
        pendingPointerLocation = windowPoint
        if pendingPointerRefresh != nil, !immediately {
            return
        }

        pendingPointerRefresh?.cancel()

        let now = ProcessInfo.processInfo.systemUptime
        let minimumInterval: TimeInterval = 1.0 / 30.0
        let elapsed = now - lastPointerRefreshTime
        let delay = immediately ? 0 : max(0, minimumInterval - elapsed)

        let refresh = DispatchWorkItem { [weak self] in
            guard
                let self,
                let window = self.pendingPointerWindow,
                window.isVisible
            else {
                self?.pendingPointerRefresh = nil
                return
            }
            self.pendingPointerRefresh = nil
            self.lastPointerRefreshTime = ProcessInfo.processInfo.systemUptime
            self.updateCursor(
                isClickable: self.isClickable(
                    at: self.pendingPointerLocation,
                    in: window
                )
            )
        }
        pendingPointerRefresh = refresh

        if delay == 0 {
            DispatchQueue.main.async(execute: refresh)
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: refresh)
        }
    }

    private func isClickable(at windowPoint: NSPoint, in window: NSWindow) -> Bool {
        guard let element = accessibilityElement(at: windowPoint, in: window) else {
            return false
        }
        return isClickable(element)
    }

    private func accessibilityElement(
        at windowPoint: NSPoint,
        in window: NSWindow
    ) -> AXUIElement? {
        let screenPoint = window.convertPoint(toScreen: windowPoint)
        guard let primaryScreenHeight = NSScreen.screens.first?.frame.maxY else {
            return nil
        }

        var element: AXUIElement?
        let application = AXUIElementCreateApplication(getpid())
        let result = AXUIElementCopyElementAtPosition(
            application,
            Float(screenPoint.x),
            Float(primaryScreenHeight - screenPoint.y),
            &element
        )
        guard result == .success, let element else { return nil }
        return element
    }

    private func isClickable(_ element: AXUIElement) -> Bool {
        var roleValue: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleValue)

        var actionsValue: CFArray?
        AXUIElementCopyActionNames(element, &actionsValue)
        let actions = (actionsValue as? [String]) ?? []

        var enabledValue: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabledValue)
        let isEnabled = (enabledValue as? Bool) ?? true

        return InteractiveAccessibilityRole.isClickable(
            role: roleValue as? String,
            actions: actions,
            isEnabled: isEnabled
        )
    }

    private func updateCursor(isClickable: Bool) {
        if isClickable {
            guard !isHandCursorActive else { return }
            NSCursor.pointingHand.set()
            isHandCursorActive = true
        } else {
            resetCursorIfNeeded()
        }
    }

    private func resetCursorIfNeeded() {
        guard isHandCursorActive else { return }
        resetCursor()
    }

    private func resetCursor() {
        if NSCursor.current === NSCursor.pointingHand {
            NSCursor.arrow.set()
        }
        isHandCursorActive = false
    }
}

private final class InteractiveClickFeedbackView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? {
        nil
    }

    static func play(in window: NSWindow, at windowPoint: NSPoint) {
        guard let host = window.contentView else { return }
        let overlay = InteractiveClickFeedbackView(frame: host.bounds)
        overlay.autoresizingMask = [.width, .height]
        overlay.wantsLayer = true
        overlay.layer?.masksToBounds = false
        host.addSubview(overlay, positioned: .above, relativeTo: nil)

        let point = overlay.convert(windowPoint, from: nil)
        overlay.addRipple(at: point, color: accentColor(for: window))

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            overlay.removeFromSuperview()
        }
    }

    private static func accentColor(for window: NSWindow) -> NSColor {
        let isDark = window.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        return isDark
            ? NSColor(srgbRed: 0.788, green: 0.659, blue: 0.298, alpha: 1)
            : NSColor(srgbRed: 0.722, green: 0.435, blue: 0.329, alpha: 1)
    }

    private func addRipple(at point: NSPoint, color: NSColor) {
        let diameter: CGFloat = 12
        let ripple = NSView(frame: NSRect(
            x: point.x - diameter / 2,
            y: point.y - diameter / 2,
            width: diameter,
            height: diameter
        ))
        ripple.wantsLayer = true
        ripple.layer?.cornerRadius = diameter / 2
        ripple.layer?.backgroundColor = color.withAlphaComponent(0.12).cgColor
        ripple.layer?.borderColor = color.withAlphaComponent(0.34).cgColor
        ripple.layer?.borderWidth = 1
        addSubview(ripple)

        let scale = CABasicAnimation(keyPath: "transform.scale")
        scale.fromValue = 0.7
        scale.toValue = 2.8

        let opacity = CABasicAnimation(keyPath: "opacity")
        opacity.fromValue = 0.9
        opacity.toValue = 0

        let group = CAAnimationGroup()
        group.animations = [scale, opacity]
        group.duration = 0.32
        group.timingFunction = CAMediaTimingFunction(name: .easeOut)
        group.isRemovedOnCompletion = false
        group.fillMode = .forwards
        ripple.layer?.add(group, forKey: "qiankunjie.click")

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.34) {
            ripple.removeFromSuperview()
        }
    }
}
