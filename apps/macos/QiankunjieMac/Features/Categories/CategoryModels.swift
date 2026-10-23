import Foundation
import QiankunjieCore

enum CategoryAssignmentOutcome: Equatable, Sendable {
    case success(succeededCount: Int, skippedCount: Int)
    case partial(succeededCount: Int, skippedCount: Int, failedCount: Int, message: String)
    case categoryUnavailable(message: String)
    case contentUnavailable(message: String)
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

enum CategoryQuickCreatePolicy {
    static func normalizedName(_ rawValue: String) -> String {
        rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func canSubmit(name: String, isSubmitting: Bool) -> Bool {
        !isSubmitting && !normalizedName(name).isEmpty
    }

    /// 根据规范化名称选择稳定的预设色，并在已有颜色冲突时向后寻找空位。
    static func suggestedColor(for name: String, existingColors: [String]) -> String {
        let usedColors = Set(existingColors.compactMap(normalizedColor))
        let seed = colorSeed(for: name)
        let startIndex = Int(seed % UInt64(categoryPresetColors.count))

        for offset in categoryPresetColors.indices {
            let index = (startIndex + offset) % categoryPresetColors.count
            let candidate = categoryPresetColors[index]
            if !usedColors.contains(candidate.uppercased()) {
                return candidate
            }
        }

        var fallbackValue = UInt32(seed & 0x00FF_FFFF)
        for _ in 0...usedColors.count {
            let candidate = String(format: "#%06X", fallbackValue)
            if !usedColors.contains(candidate) {
                return candidate
            }
            fallbackValue = (fallbackValue &* 1_664_525 &+ 1_013_904_223) & 0x00FF_FFFF
        }

        return String(format: "#%06X", fallbackValue)
    }

    private static func normalizedColor(_ rawValue: String) -> String? {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard value.range(of: "^#[0-9A-F]{6}$", options: .regularExpression) != nil else {
            return nil
        }
        return value
    }

    private static func colorSeed(for name: String) -> UInt64 {
        let normalizedName = normalizedName(name).lowercased()
        guard !normalizedName.isEmpty else { return 14_695_981_039_346_656_037 }

        var hash: UInt64 = 14_695_981_039_346_656_037
        for byte in normalizedName.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1_099_511_628_211
        }
        return hash
    }
}

let categoryPresetColors = [
    "#2F6A4F", "#3E7C83", "#536CCB", "#8A5A9E", "#B36A45", "#A67C38",
    "#647B4D", "#2F7780", "#6675B7", "#A16078", "#9B7250", "#6B7088",
]
