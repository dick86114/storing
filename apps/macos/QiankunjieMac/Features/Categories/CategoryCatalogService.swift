import Foundation
import QiankunjieCore

struct CategoryCatalogService: CategoryCatalogServicing {
    private let client: ManagementAPIClient

    init(client: ManagementAPIClient) {
        self.client = client
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        try await client.get(
            "categories",
            queryItems: [
                URLQueryItem(name: "includeInactive", value: includeInactive ? "true" : "false"),
            ]
        )
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        try await client.send("categories", method: .post, body: request)
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        try await client.send("categories/\(categoryID)", method: .patch, body: request)
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        try await client.send(
            "categories/reorder",
            method: .post,
            body: CategoryOrderRequest(categoryIDs: categoryIDs)
        )
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        try await client.delete(
            "categories/\(categoryID)",
            queryItems: [
                URLQueryItem(name: "targetCategoryId", value: String(targetCategoryID)),
            ]
        )
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        let _: CategoryMergeResponse = try await client.send(
            "categories/merge",
            method: .post,
            body: CategoryMergeRequest(
                sourceCategoryID: sourceCategoryID,
                targetCategoryID: targetCategoryID
            )
        )
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        try await client.send("categories/optimize-description", method: .post, body: request)
    }
}

private struct CategoryOrderRequest: Encodable, Sendable {
    let categoryIDs: [Int]

    enum CodingKeys: String, CodingKey {
        case categoryIDs = "categoryIds"
    }
}

private struct CategoryMergeRequest: Encodable, Sendable {
    let sourceCategoryID: Int
    let targetCategoryID: Int
}

private struct CategoryMergeResponse: Decodable, Sendable {
    let ok: Bool
}
