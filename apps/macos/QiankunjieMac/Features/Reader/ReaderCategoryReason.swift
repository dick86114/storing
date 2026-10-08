import QiankunjieCore

struct ReaderCategoryReasonPresentation {
    let shouldShowTrigger: Bool
    let reason: String?

    init(categoryResult: ArticleCategoryResult?) {
        guard categoryResult?.reviewStatus == "needs_review" else {
            shouldShowTrigger = false
            reason = nil
            return
        }

        shouldShowTrigger = true
        reason = categoryResult?.reason
    }
}
