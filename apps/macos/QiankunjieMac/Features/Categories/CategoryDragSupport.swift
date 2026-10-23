import SwiftUI

struct CategoryRowFramePreferenceKey: PreferenceKey {
    static let defaultValue: [Int: CGRect] = [:]

    static func reduce(
        value: inout [Int: CGRect],
        nextValue: () -> [Int: CGRect]
    ) {
        value.merge(nextValue(), uniquingKeysWith: { _, latest in latest })
    }
}

private struct CategoryRowFrameReader: ViewModifier {
    let categoryID: Int
    let coordinateSpaceName: String

    func body(content: Content) -> some View {
        content.background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: CategoryRowFramePreferenceKey.self,
                    value: [
                        categoryID: proxy.frame(in: .named(coordinateSpaceName))
                    ]
                )
            }
        }
    }
}

extension View {
    func recordCategoryRowFrame(
        categoryID: Int,
        in coordinateSpaceName: String
    ) -> some View {
        modifier(CategoryRowFrameReader(
            categoryID: categoryID,
            coordinateSpaceName: coordinateSpaceName
        ))
    }
}

struct CategoryDropIndicator: View {
    let placement: CategoryDropPlacement
    let color: Color

    var body: some View {
        Capsule()
            .fill(color)
            .frame(height: 3)
            .padding(.horizontal, 5)
            .offset(y: placement == .before ? -3 : 3)
            .allowsHitTesting(false)
    }
}
