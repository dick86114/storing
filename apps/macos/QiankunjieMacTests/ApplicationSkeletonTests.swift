import XCTest
@testable import QiankunjieMac

final class ApplicationSkeletonTests: XCTestCase {
    func test主应用骨架使用固定标识和显示名称() {
        XCTAssertEqual(QiankunjieMacMetadata.displayName, "乾坤戒")
        XCTAssertEqual(QiankunjieMacMetadata.bundleIdentifier, "com.idickies.storing.macos")
        XCTAssertEqual(QiankunjieMacMetadata.nativeModule, "QiankunjieCore")
    }
}
