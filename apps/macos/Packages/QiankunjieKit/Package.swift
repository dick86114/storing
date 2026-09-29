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
        .target(name: "QiankunjieNetworking", path: "Sources/QiankunjieNetworking"),
        .target(name: "QiankunjieAuth", path: "Sources/QiankunjieAuth"),
        .target(name: "QiankunjieLibrary", path: "Sources/QiankunjieLibrary"),
        .target(name: "QiankunjieCollect", path: "Sources/QiankunjieCollect"),
        .target(name: "QiankunjieReader", path: "Sources/QiankunjieReader"),
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
