import AppKit
import SwiftUI

/// 使用稳定的 SwiftUI 滚动布局，并自绘可拖动细滚动条。
struct ThinScrollView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ThinScrollContent(content: content)
    }
}

private struct ThinScrollContent<Content: View>: View {
    let content: Content
    @State private var scrollGeometry: ScrollGeometry?
    @State private var scrollPosition = ScrollPosition()

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                content
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(width: proxy.size.width)
                    .background(NativeScrollBarHider())
            }
            .scrollContentBackground(.hidden)
            .scrollIndicators(.hidden)
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollPosition($scrollPosition)
            .onScrollGeometryChange(for: ScrollGeometry.self) { geometry in
                geometry
            } action: { _, newValue in
                scrollGeometry = newValue
            }
        }
        .overlay(alignment: .topTrailing) {
            ThinScrollBar(geometry: scrollGeometry) { offsetY in
                scrollPosition.scrollTo(y: offsetY)
            }
            .frame(width: 16)
        }
    }
}

/// 只关闭当前细滚动容器对应的原生滚动条，避免系统滚动条与自绘滚动条同时出现。
private struct NativeScrollBarHider: NSViewRepresentable {
    func makeNSView(context: Context) -> ScrollBarHiderView {
        ScrollBarHiderView()
    }

    func updateNSView(_ nsView: ScrollBarHiderView, context: Context) {
        nsView.hideEnclosingScrollBar()
    }
}

private final class ScrollBarHiderView: NSView {
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        hideEnclosingScrollBar()
    }

    override func viewDidMoveToSuperview() {
        super.viewDidMoveToSuperview()
        hideEnclosingScrollBar()
    }

    func hideEnclosingScrollBar() {
        if hideNearestScrollView() { return }

        DispatchQueue.main.async { [weak self] in
            self?.hideNearestScrollView()
        }
    }

    @discardableResult
    private func hideNearestScrollView() -> Bool {
        var candidate = superview
        while let view = candidate {
            if let scrollView = view as? NSScrollView {
                scrollView.hasVerticalScroller = false
                scrollView.hasHorizontalScroller = false
                scrollView.autohidesScrollers = true
                return true
            }
            candidate = view.superview
        }
        return false
    }
}

private struct ThinScrollBar: View {
    let geometry: ScrollGeometry?
    let onScroll: @MainActor (CGFloat) -> Void
    @State private var dragStartLocationY: CGFloat?
    @State private var dragInitialContentOffsetY: CGFloat?
    @State private var isDragging = false
    @State private var isHovering = false

    var body: some View {
        GeometryReader { proxy in
            if
                let geometry,
                let model = ThinScrollBarModel(
                    geometry: geometry,
                    trackHeight: proxy.size.height - 16
                )
            {
                ZStack(alignment: .topTrailing) {
                    Color.clear
                        .contentShape(Rectangle())

                    Capsule()
                        .fill(Color(white: 0.45))
                        .opacity(scrollBarOpacity)
                        .frame(width: 4, height: model.thumbHeight)
                        .padding(.trailing, 3)
                        .padding(.top, model.thumbOffset)
                }
                .frame(width: 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .onHover { isHovering in
                    self.isHovering = isHovering
                }
                .gesture(scrollDragGesture(model: model))
            }
        }
        .frame(width: 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .allowsHitTesting(true)
    }

    private var scrollBarOpacity: Double {
        ThinScrollBarAppearance.thumbOpacity(
            isDragging: isDragging,
            isHovering: isHovering
        )
    }

    private func scrollDragGesture(model: ThinScrollBarModel) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let startLocationY = dragStartLocationY ?? value.startLocation.y
                let initialContentOffsetY = dragInitialContentOffsetY
                    ?? geometry?.contentOffset.y
                    ?? 0

                dragStartLocationY = startLocationY
                dragInitialContentOffsetY = initialContentOffsetY
                isDragging = true

                let targetOffsetY = model.targetContentOffset(
                    startLocationY: startLocationY,
                    locationY: value.location.y,
                    initialContentOffsetY: initialContentOffsetY,
                    isThumbDrag: model.isThumb(atY: startLocationY)
                )
                onScroll(targetOffsetY)
            }
            .onEnded { _ in
                dragStartLocationY = nil
                dragInitialContentOffsetY = nil
                isDragging = false
            }
    }
}

enum ThinScrollBarAppearance {
    static func thumbOpacity(isDragging: Bool, isHovering: Bool) -> Double {
        if isDragging {
            return 0.48
        }
        if isHovering {
            return 0.36
        }
        return 0.24
    }
}

struct ThinScrollBarModel: Equatable {
    let thumbHeight: CGFloat
    let thumbOffset: CGFloat
    let maximumContentOffset: CGFloat
    let maximumTravel: CGFloat

    init?(
        geometry: ScrollGeometry,
        trackHeight: CGFloat
    ) {
        let maximumContentOffset = max(
            0,
            geometry.contentSize.height - geometry.containerSize.height
        )
        guard maximumContentOffset > 1, trackHeight > 0 else {
            return nil
        }

        let thumbHeight = max(
            36,
            trackHeight * geometry.containerSize.height / geometry.contentSize.height
        )
        let maximumTravel = max(0, trackHeight - thumbHeight)
        let progress = min(
            max(geometry.contentOffset.y / maximumContentOffset, 0),
            1
        )

        self.thumbHeight = thumbHeight
        self.thumbOffset = 8 + progress * maximumTravel
        self.maximumContentOffset = maximumContentOffset
        self.maximumTravel = maximumTravel
    }

    func isThumb(atY locationY: CGFloat) -> Bool {
        locationY >= thumbOffset && locationY <= thumbOffset + thumbHeight
    }

    func targetContentOffset(
        startLocationY: CGFloat,
        locationY: CGFloat,
        initialContentOffsetY: CGFloat,
        isThumbDrag: Bool
    ) -> CGFloat {
        guard maximumTravel > 0 else {
            return 0
        }

        if isThumbDrag, isThumb(atY: startLocationY) {
            let moved = locationY - startLocationY
            return clamp(
                initialContentOffsetY + moved * maximumContentOffset / maximumTravel
            )
        }

        let desiredThumbTop = locationY - 8 - thumbHeight / 2
        let progress = min(max(desiredThumbTop / maximumTravel, 0), 1)
        return progress * maximumContentOffset
    }

    private func clamp(_ value: CGFloat) -> CGFloat {
        min(max(value, 0), maximumContentOffset)
    }
}
