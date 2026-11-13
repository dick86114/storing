import XCTest
import QiankunjieCore
@testable import QiankunjieMac

final class DeepAnalysisPresentationTests: XCTestCase {
    func testStatusPresentationMapsUnifiedStates() {
        XCTAssertEqual(DeepAnalysisPresentation.of("running"), .running)
        XCTAssertEqual(DeepAnalysisPresentation.of("succeeded"), .completed)
        XCTAssertEqual(DeepAnalysisPresentation.of("failed"), .failed)
    }

    func testOfflineSubmissionIsDisabledButReportRemainsReadable() {
        XCTAssertTrue(DeepAnalysisPresentation.canRead(.completed))
        XCTAssertFalse(DeepAnalysisPresentation.offlineSubmitAllowed)
    }

    func testInspectorRendersUnifiedSections() {
        XCTAssertEqual(DeepAnalysisInspector.sections.count, 9)
        XCTAssertTrue(DeepAnalysisInspector.sections.contains("不同观点"))
    }

    func testUnifiedAPIPathsAreStable() {
        XCTAssertEqual(DeepAnalysisAPIPaths.submit(articleID: 7), "articles/7/deep-analysis")
        XCTAssertEqual(DeepAnalysisAPIPaths.versions(articleID: 7), "articles/7/deep-analysis/versions")
        XCTAssertEqual(DeepAnalysisAPIPaths.restore(articleID: 7, version: 2), "articles/7/deep-analysis/2/restore")
    }
}
