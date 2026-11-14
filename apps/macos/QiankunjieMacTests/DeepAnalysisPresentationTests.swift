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

    func testExistingReportOpensDirectlyAndMissingReportRequiresConfirmation() {
        XCTAssertEqual(
            DeepAnalysisEntryAction.of(
                summary: DeepAnalysisSummary(hasDeepAnalysis: true, status: "succeeded")
            ),
            .viewReport
        )
        XCTAssertEqual(
            DeepAnalysisEntryAction.of(
                summary: DeepAnalysisSummary(hasDeepAnalysis: false, status: "failed")
            ),
            .confirmGeneration
        )
        XCTAssertEqual(DeepAnalysisEntryAction.of(summary: nil), .confirmGeneration)
    }

    func testDeepAnalysisConfirmationCopyExplainsAsyncGeneration() {
        let action = ReaderArticleAction.deepAnalysis
        XCTAssertEqual(action.confirmationTitle, "生成深度报告？")
        XCTAssertEqual(action.buttonTitle, "生成报告")
        XCTAssertTrue(action.confirmationMessage.contains("异步"))
        XCTAssertTrue(action.confirmationMessage.contains("通知"))
    }

    func testDeepAnalysisNotificationsDoNotReplaceReportContent() {
        let completed = DeepAnalysisNotificationMessage.completed(articleTitle: "测试文章")
        let failed = DeepAnalysisNotificationMessage.failed(articleTitle: "测试文章")

        XCTAssertEqual(completed.title, "深度报告已生成")
        XCTAssertTrue(completed.body.contains("测试文章"))
        XCTAssertEqual(failed.title, "深度报告生成失败")
        XCTAssertTrue(failed.body.contains("重新生成"))
    }
}
