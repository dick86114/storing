import SwiftUI

/// 使用稳定的 SwiftUI 滚动布局，并自绘细滚动条。
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

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(NativeScrollBarHider())
        .scrollContentBackground(.hidden)
        .scrollIndicators(.hidden)
        .onScrollGeometryChange(for: ScrollGeometry.self) { geometry in
            geometry
        } action: { _, newValue in
            scrollGeometry = newValue
        }
        .overlay(alignment: .trailing) {
            ThinScrollBar(geometry: scrollGeometry)
        }
    }
}

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

    func hideEnclosingScrollBar() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            var currentView: NSView? = self
            while let view = currentView {
                guard let scrollView = view as? NSScrollView else {
                    currentView = view.superview
                    continue
                }

                scrollView.hasVerticalScroller = false
                scrollView.hasHorizontalScroller = false
                scrollView.autohidesScrollers = true
                return
            }


            for window in NSApp.windows {
                hideScrollBars(in: window.contentView)
            }
        }
    }

    private func hideScrollBars(in view: NSView?) {
        guard let view else { return }

        if let scrollView = view as? NSScrollView {
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
            scrollView.autohidesScrollers = true
        }

        view.subviews.forEach(hideScrollBars)
    }
}

private struct ThinScrollBar: View {
    let geometry: ScrollGeometry?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            if
                let geometry,
                geometry.contentSize.height > geometry.containerSize.height + 1
            {
                let trackHeight = proxy.size.height - 16
                let thumbHeight = max(
                    36,
                    trackHeight * geometry.containerSize.height / geometry.contentSize.height
                )
                let maximumOffset = geometry.contentSize.height - geometry.containerSize.height
                let progress = maximumOffset > 0
                    ? geometry.contentOffset.y / maximumOffset
                    : 0
                let maximumTravel = trackHeight - thumbHeight

                Capsule()
                    .fill(
                        colorScheme == .dark
                            ? Color.white.opacity(0.24)
                            : Color.black.opacity(0.2)
                    )
                    .frame(width: 4, height: thumbHeight)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, 3)
                    .offset(y: 8 + progress * maximumTravel)
            }
        }
        .allowsHitTesting(false)
    }
}
