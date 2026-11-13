import XCTest
import QiankunjieCore
@testable import QiankunjieMac

final class DeepAnalysisModelsTests: XCTestCase {
    func testSummaryDecodesUnifiedContract() throws {
        let data = Data("""
        {"hasDeepAnalysis":true,"status":"succeeded","version":2,"generatedAt":"2026-11-14T00:00:00Z","stale":true,"errorCode":null}
        """.utf8)
        let summary = try JSONDecoder.qiankunjie.decode(DeepAnalysisSummary.self, from: data)

        XCTAssertEqual(summary.version, 2)
        XCTAssertTrue(summary.stale)
        XCTAssertEqual(summary.status, "succeeded")
    }

    func testArticleCardDecodesOptionalDeepStatus() throws {
        let data = Data("""
        {"id":7,"deepAnalysis":{"hasDeepAnalysis":false,"status":"running","version":1,"generatedAt":null,"stale":false,"errorCode":null}}
        """.utf8)
        let card = try JSONDecoder.qiankunjie.decode(ArticleCard.self, from: data)

        XCTAssertEqual(card.deepAnalysis?.status, "running")
    }

    func testReportDecodesAllNineSections() throws {
        let data = Data("""
        {"executiveSummary":"摘要","coreArguments":[],"reasoningChain":[],"keyFacts":[],"viewpoints":[],"risks":[],"actions":[],"questions":[],"readingPath":[]}
        """.utf8)
        let report = try JSONDecoder.qiankunjie.decode(DeepAnalysisReport.self, from: data)

        XCTAssertEqual(report.executiveSummary, "摘要")
    }
}
