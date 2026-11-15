import XCTest
import QiankunjieCore
@testable import QiankunjieMac

@MainActor
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
        XCTAssertEqual(DeepAnalysisInspector.sections.count, 10)
        XCTAssertTrue(DeepAnalysisInspector.sections.contains("不同观点"))
        XCTAssertTrue(DeepAnalysisInspector.sections.contains("AI 写作倾向"))
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
        XCTAssertEqual(
            DeepAnalysisEntryAction.of(
                summary: DeepAnalysisSummary(status: "running"),
                hasReport: true
            ),
            .viewReport
        )
    }

    func testListMarkerReflectsGenerationStates() {
        XCTAssertEqual(DeepAnalysisListMarker.of(nil).kind, .hidden)
        XCTAssertEqual(
            DeepAnalysisListMarker.of(DeepAnalysisSummary(status: "running")).kind,
            .running
        )
        XCTAssertEqual(
            DeepAnalysisListMarker.of(DeepAnalysisSummary(status: "succeeded")).kind,
            .ready
        )
        XCTAssertEqual(
            DeepAnalysisListMarker.of(DeepAnalysisSummary(status: "failed")).kind,
            .failed
        )
        XCTAssertTrue(
            DeepAnalysisListMarker.of(
                DeepAnalysisSummary(status: "succeeded", stale: true)
            ).helpText.contains("旧版正文")
        )
    }

    func testReportAnalyticsDriveEvidenceStanceAndWritingSections() {
        let report = UILabFixtures.deepAnalysisRecord.reportJson!
        let evidence = DeepAnalysisReportAnalytics.evidenceMix(report)
        let stances = DeepAnalysisReportAnalytics.stanceMix(report)
        let thoughts = DeepAnalysisReportAnalytics.sectionThoughts(report)

        XCTAssertEqual(evidence.source, 5)
        XCTAssertEqual(evidence.inference, 1)
        XCTAssertEqual(evidence.sourcePercent, 83)
        XCTAssertEqual(stances.support, 1)
        XCTAssertEqual(stances.conditional, 2)
        XCTAssertEqual(stances.oppose, 1)
        XCTAssertEqual(DeepAnalysisReportAnalytics.aiWritingBand(68), .ai)
        XCTAssertTrue(thoughts[.facts]?.contains("6 条关键信息") == true)
        XCTAssertTrue(thoughts[.aiWriting]?.contains("68/100") == true)
        XCTAssertTrue(DeepAnalysisSection.arguments.hint.contains("最想让你相信"))
    }

    func testReportAnchorsUseStableSectionIDs() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(
            contentsOf: repositoryRoot
                .appendingPathComponent("QiankunjieMac")
                .appendingPathComponent("Features")
                .appendingPathComponent("Reader")
                .appendingPathComponent("DeepAnalysisInspector.swift"),
            encoding: .utf8
        )

        for section in DeepAnalysisSection.allCases {
            XCTAssertTrue(
                source.contains(".id(DeepAnalysisSection.\(section.rawValue).id)"),
                "缺少稳定的滚动锚点：\(section.rawValue)"
            )
        }
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
