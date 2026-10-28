import AppKit
import QiankunjieDesignSystem
import SwiftUI

/// 段落中的低调内联链接：默认与正文一致，只在鼠标悬停时显示强调色和下划线。
struct InteractiveInlineLinkText: NSViewRepresentable {
    let text: String
    let linkText: String
    let destination: URL
    let colorScheme: ColorScheme

    func makeNSView(context: Context) -> InteractiveInlineLinkLabel {
        let view = InteractiveInlineLinkLabel()
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateNSView(_ view: InteractiveInlineLinkLabel, context: Context) {
        let scale = context.environment.qiankunjieAppFontScale
        view.configure(
            text: text,
            linkText: linkText,
            destination: destination,
            font: .systemFont(ofSize: 12 * scale, weight: .medium),
            textColor: NSColor(QiankunjieColors.onSurfaceVariant(for: colorScheme)),
            accentColor: NSColor(QiankunjieColors.accent(for: colorScheme))
        )
    }

    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView: InteractiveInlineLinkLabel,
        context: Context
    ) -> CGSize? {
        guard let width = proposal.width, width.isFinite else { return nil }
        return CGSize(width: width, height: nsView.height(forWidth: width))
    }
}

final class InteractiveInlineLinkLabel: NSView {
    private let textStorage = NSTextStorage()
    private let layoutManager = NSLayoutManager()
    private let textContainer = NSTextContainer(size: .zero)
    private var viewTrackingArea: NSTrackingArea?
    private var linkTrackingArea: NSTrackingArea?
    private var linkRange = NSRange(location: NSNotFound, length: 0)
    private var destination: URL?
    private var plainText = ""
    private var textColor = NSColor.secondaryLabelColor
    private var accentColor = NSColor.controlAccentColor
    private var isHoveringLink = false

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { false }

    init() {
        super.init(frame: .zero)
        textContainer.lineFragmentPadding = 0
        textContainer.maximumNumberOfLines = 0
        textContainer.lineBreakMode = .byWordWrapping
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)
        setAccessibilityElement(true)
        setAccessibilityRole(.link)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) 未实现")
    }

    func configure(
        text: String,
        linkText: String,
        destination: URL,
        font: NSFont,
        textColor: NSColor,
        accentColor: NSColor
    ) {
        let range = (text as NSString).range(of: linkText)
        let needsRebuild =
            plainText != text
            || self.textColor != textColor
            || self.accentColor != accentColor
            || currentFont != font
            || linkRange != range

        self.destination = destination
        self.textColor = textColor
        self.accentColor = accentColor
        plainText = text
        linkRange = range
        setAccessibilityLabel(linkText)
        setAccessibilityHelp("在浏览器中打开 \(destination.host ?? destination.absoluteString)")

        if needsRebuild {
            rebuild(font: font)
        }
    }

    func height(forWidth width: CGFloat) -> CGFloat {
        guard width > 0 else { return 0 }
        textContainer.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        layoutManager.ensureLayout(for: textContainer)
        return ceil(layoutManager.usedRect(for: textContainer).height)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        rebuildTrackingAreas()
    }

    private func rebuildTrackingAreas() {
        if let viewTrackingArea {
            removeTrackingArea(viewTrackingArea)
        }
        if let linkTrackingArea {
            removeTrackingArea(linkTrackingArea)
        }

        let trackingArea = NSTrackingArea(
            rect: .zero,
            options: [
                .mouseMoved,
                .mouseEnteredAndExited,
                .activeInKeyWindow,
                .inVisibleRect,
            ],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
        viewTrackingArea = trackingArea

        guard let linkRect else {
            linkTrackingArea = nil
            return
        }
        let linkArea = NSTrackingArea(
            rect: linkRect.insetBy(dx: -2, dy: -2),
            options: [
                .mouseEnteredAndExited,
                .activeInKeyWindow,
            ],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(linkArea)
        linkTrackingArea = linkArea
    }

    override func layout() {
        super.layout()
        textContainer.containerSize = NSSize(
            width: max(0, bounds.width),
            height: .greatestFiniteMagnitude
        )
        layoutManager.ensureLayout(for: textContainer)
        let desiredLinkTrackingRect = linkRect?.insetBy(dx: -2, dy: -2)
        if linkTrackingArea?.rect != desiredLinkTrackingRect {
            rebuildTrackingAreas()
        }
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let glyphRange = layoutManager.glyphRange(for: textContainer)
        layoutManager.drawGlyphs(forGlyphRange: glyphRange, at: .zero)
    }

    override func mouseMoved(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let hovering = linkRect?.contains(point) == true
        setHoveringLink(hovering)
        if hovering {
            NSCursor.pointingHand.set()
        } else if NSCursor.current === NSCursor.pointingHand {
            NSCursor.arrow.set()
        }
    }

    override func mouseEntered(with event: NSEvent) {
        guard event.trackingArea === linkTrackingArea else { return }
        setHoveringLink(true)
        NSCursor.pointingHand.set()
    }

    override func mouseExited(with event: NSEvent) {
        if event.trackingArea === linkTrackingArea {
            setHoveringLink(false)
            if NSCursor.current === NSCursor.pointingHand {
                NSCursor.arrow.set()
            }
        } else if event.trackingArea === viewTrackingArea {
            setHoveringLink(false)
        }
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        guard linkRect?.contains(point) == true, let destination else {
            super.mouseDown(with: event)
            return
        }
        NSWorkspace.shared.open(destination)
    }

    override func accessibilityFrame() -> NSRect {
        guard let window, let linkRect else {
            return super.accessibilityFrame()
        }
        return window.convertToScreen(convert(linkRect, to: nil))
    }

    override func accessibilityPerformPress() -> Bool {
        guard let destination else { return false }
        NSWorkspace.shared.open(destination)
        return true
    }

    private var currentFont: NSFont? {
        guard textStorage.length > 0 else { return nil }
        return textStorage.attribute(.font, at: 0, effectiveRange: nil) as? NSFont
    }

    private var linkRect: NSRect? {
        guard linkRange.location != NSNotFound, linkRange.length > 0 else { return nil }
        let glyphRange = layoutManager.glyphRange(
            forCharacterRange: linkRange,
            actualCharacterRange: nil
        )
        let rect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
        return rect.isEmpty ? nil : rect
    }

    private func rebuild(font: NSFont) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byWordWrapping
        paragraph.lineSpacing = 1

        let styled = NSMutableAttributedString(
            string: plainText,
            attributes: [
                .font: font,
                .foregroundColor: textColor,
                .paragraphStyle: paragraph,
            ]
        )
        if linkRange.location != NSNotFound {
            styleLink(in: styled, hovering: isHoveringLink)
        }

        textStorage.beginEditing()
        textStorage.setAttributedString(styled)
        textStorage.endEditing()
        textContainer.containerSize = NSSize(
            width: max(0, bounds.width),
            height: .greatestFiniteMagnitude
        )
        layoutManager.ensureLayout(for: textContainer)
        rebuildTrackingAreas()
        invalidateIntrinsicContentSize()
        needsDisplay = true
    }

    private func setHoveringLink(_ hovering: Bool) {
        guard isHoveringLink != hovering else { return }
        isHoveringLink = hovering
        guard linkRange.location != NSNotFound else { return }
        let styled = NSMutableAttributedString(attributedString: textStorage)
        styleLink(in: styled, hovering: hovering)
        textStorage.beginEditing()
        textStorage.setAttributedString(styled)
        textStorage.endEditing()
        needsDisplay = true
    }

    private func styleLink(in string: NSMutableAttributedString, hovering: Bool) {
        guard linkRange.location != NSNotFound else { return }
        string.addAttributes(
            [
                .foregroundColor: hovering ? accentColor : textColor,
                .underlineStyle: hovering ? NSUnderlineStyle.single.rawValue : 0,
                .underlineColor: hovering ? accentColor : textColor,
            ],
            range: linkRange
        )
    }
}
