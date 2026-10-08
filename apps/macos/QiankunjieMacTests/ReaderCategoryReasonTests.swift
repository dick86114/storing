import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct ReaderCategoryReasonTests {
    @Test func pendingAIReasonShowsAnIconTriggerBesideCategory() {
        let categoryResult = ArticleCategoryResult(
            categoryId: 8,
            confidence: 0.62,
            reason: "内容属于部署教程。",
            source: "ai",
            reviewStatus: "needs_review",
            modelVersion: "model-1"
        )

        let presentation = ReaderCategoryReasonPresentation(categoryResult: categoryResult)

        #expect(presentation.shouldShowTrigger)
        #expect(presentation.reason == "内容属于部署教程。")
    }

    @Test func confirmedOrMissingReasonDoesNotShowTrigger() {
        let confirmed = ArticleCategoryResult(
            categoryId: 8,
            confidence: 0.9,
            reason: "内容属于部署教程。",
            source: "ai",
            reviewStatus: "confirmed",
            modelVersion: "model-1"
        )

        #expect(!ReaderCategoryReasonPresentation(categoryResult: confirmed).shouldShowTrigger)
        #expect(!ReaderCategoryReasonPresentation(categoryResult: nil).shouldShowTrigger)
    }
}
