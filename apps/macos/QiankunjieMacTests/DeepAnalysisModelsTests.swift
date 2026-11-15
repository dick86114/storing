import XCTest
import QiankunjieCore
import QiankunjieReader
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
        {"executiveSummary":"摘要","coreArguments":[],"reasoningChain":[],"keyFacts":[],"viewpoints":[],"risks":[],"actions":[],"questions":[],"readingPath":[],
         "aiWriting":{"score":72,"summary":"可能经过 AI 辅助","signals":[{"label":"段落均衡","detail":"段落长度接近","leaning":"ai"}]}}
        """.utf8)
        let report = try JSONDecoder.qiankunjie.decode(DeepAnalysisReport.self, from: data)

        XCTAssertEqual(report.executiveSummary, "摘要")
        XCTAssertEqual(report.aiWriting?.score, 72)
        XCTAssertEqual(report.aiWriting?.signals.first?.leaning, "ai")
    }

    func testReportResponseDecodesRecordEnvelopeAndLegacyReport() throws {
        let data = Data("""
        {"report":{"version":3,"reportJson":{"executiveSummary":"摘要","coreArguments":[],"reasoningChain":[],"keyFacts":[],"viewpoints":[],"risks":[],"actions":[],"questions":[],"readingPath":[]},
         "reportMarkdown":"# 摘要","providerSnapshot":"custom","modelSnapshot":"mimo-v2.6-flash","promptTokens":10,"completionTokens":20,"totalTokens":30,"contentTruncated":false,"attempts":1,"durationMs":80000,"generatedAt":"2026-11-15T03:08:00Z"},
         "summary":{"hasDeepAnalysis":true,"status":"succeeded","version":3,"generatedAt":"2026-11-15T03:08:00Z","stale":false,"errorCode":null}}
        """.utf8)
        let response = try JSONDecoder.qiankunjie.decode(DeepAnalysisResponse.self, from: data)

        XCTAssertEqual(response.reportRecord?.version, 3)
        XCTAssertEqual(response.reportRecord?.totalTokens, 30)
        XCTAssertEqual(response.report?.executiveSummary, "摘要")

        let legacyData = Data("""
        {"report":{"executiveSummary":"旧报告","coreArguments":[],"reasoningChain":[],"keyFacts":[],"viewpoints":[],"risks":[],"actions":[],"questions":[],"readingPath":[]},
         "summary":null}
        """.utf8)
        let legacy = try JSONDecoder.qiankunjie.decode(DeepAnalysisResponse.self, from: legacyData)
        XCTAssertEqual(legacy.report?.executiveSummary, "旧报告")
    }
}
