// swift-tools-version: 6.4
import PackageDescription

let package = Package(
    name: "QiankunjieKit",
    platforms: [
        .macOS(.v27),
    ],
    products: [
        .library(
            name: "QiankunjieKit",
            targets: [
                "QiankunjieCore",
                "QiankunjieNetworking",
                "QiankunjieAuth",
                "QiankunjieLibrary",
                "QiankunjieCollect",
                "QiankunjieReader",
                "QiankunjieDesignSystem",
                "QiankunjieUpdating",
            ]
        ),
    ],
    targets: [
        .target(name: "QiankunjieCore", path: "Sources/QiankunjieCore"),
        .target(
            name: "QiankunjieNetworking",
            dependencies: [
                "QiankunjieCore",
            ],
            path: "Sources/QiankunjieNetworking"
        ),
        .target(
            name: "QiankunjieAuth",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
            ],
            path: "Sources/QiankunjieAuth"
        ),
        .target(
            name: "QiankunjieLibrary",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
            ],
            path: "Sources/QiankunjieLibrary"
        ),
        .target(
            name: "QiankunjieCollect",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
            ],
            path: "Sources/QiankunjieCollect"
        ),
        .target(
            name: "QiankunjieReader",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
            ],
            path: "Sources/QiankunjieReader"
        ),
        .target(name: "QiankunjieDesignSystem", path: "Sources/QiankunjieDesignSystem"),
        .target(name: "QiankunjieUpdating", path: "Sources/QiankunjieUpdating"),
        .testTarget(
            name: "QiankunjieCoreTests",
            dependencies: [
                "QiankunjieCore",
            ],
            path: "Tests/QiankunjieCoreTests"
        ),
        .testTarget(
            name: "QiankunjieDesignSystemTests",
            dependencies: [
                "QiankunjieDesignSystem",
            ],
            path: "Tests/QiankunjieDesignSystemTests"
        ),
        .testTarget(
            name: "QiankunjieNetworkingTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
            ],
            path: "Tests/QiankunjieNetworkingTests"
        ),
        .testTarget(
            name: "QiankunjieAuthTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
                "QiankunjieAuth",
            ],
            path: "Tests/QiankunjieAuthTests"
        ),
        .testTarget(
            name: "QiankunjieLibraryTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
                "QiankunjieLibrary",
            ],
            path: "Tests/QiankunjieLibraryTests"
        ),
        .testTarget(
            name: "QiankunjieReaderTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
                "QiankunjieReader",
            ],
            path: "Tests/QiankunjieReaderTests"
        ),
        .testTarget(
            name: "QiankunjieCollectTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieCollect",
            ],
            path: "Tests/QiankunjieCollectTests"
        ),
        .testTarget(
            name: "QiankunjieKitTests",
            dependencies: [
                "QiankunjieCore",
                "QiankunjieNetworking",
                "QiankunjieAuth",
                "QiankunjieLibrary",
                "QiankunjieCollect",
                "QiankunjieReader",
                "QiankunjieDesignSystem",
                "QiankunjieUpdating",
            ],
            path: "Tests/QiankunjieKitTests"
        ),
    ],
    swiftLanguageModes: [.v6]
)
