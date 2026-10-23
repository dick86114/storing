import Foundation
import QiankunjieCore

enum CategoryAssignmentOutcome: Equatable, Sendable {
    case success(succeededCount: Int, skippedCount: Int)
    case partial(succeededCount: Int, skippedCount: Int, failedCount: Int, message: String)
    case categoryUnavailable(message: String)
    case failure(message: String)
}

protocol CategoryCatalogServicing: Sendable {
    func list(includeInactive: Bool) async throws -> CategoriesResponse
    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse
    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse
    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse
    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse
    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws
    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse
}

struct CategoryDraft: Sendable {
    var name = ""
    var description = ""
    var includeExamples: [String] = []
    var excludeExamples: [String] = []
    var color = categoryPresetColors[0]

    init() {}

    init(category: ArticleCategory) {
        name = category.name
        description = category.articleDescription ?? ""
        includeExamples = category.includeExamples
        excludeExamples = category.excludeExamples
        color = category.color ?? categoryPresetColors[0]
    }
}

let categoryPresetColors = [
    "#2F6A4F", "#3E7C83", "#536CCB", "#8A5A9E", "#B36A45", "#A67C38",
    "#647B4D", "#2F7780", "#6675B7", "#A16078", "#9B7250", "#6B7088",
]
