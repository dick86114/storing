import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryCatalogModelTests {
    @Test func 加载分类目录会规范计数并只按服务端顺序暴露启用分类() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [
                    分类(id: 11, sortOrder: 30, isActive: false),
                    分类(id: 31, sortOrder: 20),
                    分类(id: 21, sortOrder: 10),
                ],
                counts: ["21": 4, "31": 2, "bad": 9, "-3": 8]
            )),
        ])
        let store = 最近分类存储桩(记录: [7: [31, 21]])
        let model = CategoryCatalogModel(service: service, recentStore: store)

        model.prepareUser(userID: 7)
        await model.load()

        #expect(model.categories.map(\.id) == [21, 31, 11])
        #expect(model.activeCategories.map(\.id) == [21, 31])
        #expect(model.count(for: 21) == 4)
        #expect(model.count(for: 999) == 0)
        #expect(model.counts == [21: 4, 31: 2])
        #expect(model.recentCategoryIDs == [31, 21])
    }

    @Test func 切换用户会清空分类和最近使用并读取新用户记录() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10), 分类(id: 31, sortOrder: 20)],
                counts: ["21": 3, "31": 5]
            )),
            .success(CategoriesResponse(
                categories: [分类(id: 41, sortOrder: 10)],
                counts: ["41": 2]
            )),
        ])
        let store = 最近分类存储桩(记录: [1: [21, 31], 2: [41]])
        let model = CategoryCatalogModel(service: service, recentStore: store)

        model.prepareUser(userID: 1)
        await model.load()
        model.recordRecent(categoryID: 31)
        #expect(model.recentCategoryIDs == [31, 21])

        model.prepareUser(userID: 2)
        #expect(model.categories.isEmpty)
        #expect(model.counts.isEmpty)
        #expect(model.recentCategoryIDs == [41])

        await model.load()
        #expect(model.categories.map(\.id) == [41])
        #expect(model.recentCategories.map(\.id) == [41])

        model.prepareUser(userID: nil)
        #expect(model.categories.isEmpty)
        #expect(model.counts.isEmpty)
        #expect(model.recentCategoryIDs.isEmpty)
    }

    @Test func 旧用户分类响应晚到不会写入新用户() async {
        let service = 延迟分类服务桩(
            旧用户响应: CategoriesResponse(
                categories: [分类(id: 11, sortOrder: 10)],
                counts: ["11": 9]
            ),
            新用户响应: CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 2]
            )
        )
        let store = 最近分类存储桩(记录: [1: [11], 2: [21]])
        let model = CategoryCatalogModel(service: service, recentStore: store)

        model.prepareUser(userID: 1)
        let 旧用户加载 = Task { @MainActor in
            await model.load()
        }
        await service.等待第一次列表请求开始()

        model.prepareUser(userID: 2)
        let 新用户加载 = Task { @MainActor in
            await model.load()
        }
        await 新用户加载.value
        #expect(model.categories.map(\.id) == [21])
        #expect(model.counts == [21: 2])
        #expect(model.recentCategoryIDs == [21])

        await service.放行旧用户响应()
        await 旧用户加载.value

        #expect(model.categories.map(\.id) == [21])
        #expect(model.counts == [21: 2])
        #expect(model.recentCategoryIDs == [21])
    }

    @Test func 刷新会移除已删除或停用的最近分类() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20),
                    分类(id: 3, sortOrder: 30),
                ],
                counts: ["1": 1, "2": 2, "3": 3]
            )),
            .success(CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20, isActive: false),
                    分类(id: 4, sortOrder: 30),
                ],
                counts: ["1": 1, "2": 2, "4": 3]
            )),
        ])
        let store = 最近分类存储桩(记录: [8: [3, 2]])
        let model = CategoryCatalogModel(service: service, recentStore: store)

        model.prepareUser(userID: 8)
        await model.load()
        model.recordRecent(categoryID: 1)
        #expect(model.recentCategoryIDs == [1, 3, 2])

        await model.load()

        #expect(model.recentCategoryIDs == [1])
        #expect(store.记录[8] == [1])
    }

    @Test func 创建分类成功后立即进入共享目录() async throws {
        let service = 分类服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, sortOrder: 10)],
                    counts: ["1": 2]
                )),
            ],
            创建响应: [
                .success(CategoryResponse(category: 分类(id: 2, name: "设计", sortOrder: 20))),
            ]
        )
        let store = 最近分类存储桩()
        let model = CategoryCatalogModel(service: service, recentStore: store)
        var 目录变化次数 = 0
        model.onCategoriesChanged = {
            目录变化次数 += 1
        }

        model.prepareUser(userID: 5)
        await model.load()
        var draft = CategoryDraft()
        draft.name = " 设计 "
        draft.description = " 设计案例 "

        let created = try await model.create(draft)

        #expect(created.id == 2)
        #expect(model.categories.map(\.id) == [1, 2])
        #expect(model.activeCategories.map(\.id) == [1, 2])
        #expect(model.count(for: 2) == 0)
        #expect(目录变化次数 == 2)
    }

    @Test func 创建发出后的旧读取响应晚到不会覆盖新目录() async throws {
        let service = 旧读取与创建交错服务桩(
            初始目录: CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 2]
            ),
            旧目录结果: .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 2]
            )),
            新分类: 分类(id: 2, name: "设计", sortOrder: 20)
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())

        model.prepareUser(userID: 5)
        await model.load()
        let 旧读取 = Task { @MainActor in
            await model.load()
        }
        await service.等待第二次列表请求开始()

        var draft = CategoryDraft()
        draft.name = "设计"
        let created = try await model.create(draft)
        #expect(created.id == 2)
        #expect(model.categories.map(\.id) == [1, 2])

        await service.放行旧目录响应()
        await 旧读取.value

        #expect(model.categories.map(\.id) == [1, 2])
        #expect(model.counts == [1: 2, 2: 0])
    }

    @Test func 创建后的旧读取失败不会覆盖成功状态() async throws {
        let service = 旧读取与创建交错服务桩(
            初始目录: CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 2]
            ),
            旧目录结果: .failure(.缺少响应),
            新分类: 分类(id: 2, name: "设计", sortOrder: 20)
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())

        model.prepareUser(userID: 5)
        await model.load()
        let 旧读取 = Task { @MainActor in
            await model.load()
        }
        await service.等待第二次列表请求开始()

        var draft = CategoryDraft()
        draft.name = "设计"
        _ = try await model.create(draft)

        await service.放行旧目录响应()
        await 旧读取.value

        #expect(model.categories.map(\.id) == [1, 2])
        #expect(model.errorMessage == nil)
    }

    @Test func 合并成功但刷新失败会向调用方抛错并保留旧目录() async throws {
        let service = 分类服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, sortOrder: 10), 分类(id: 2, sortOrder: 20)],
                    counts: ["1": 3, "2": 4]
                )),
                .failure(.缺少响应),
            ],
            合并响应: [.success(())]
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())

        model.prepareUser(userID: 7)
        await model.load()

        do {
            try await model.merge(sourceCategoryID: 1, targetCategoryID: 2)
            Issue.record("服务端合并成功但刷新失败时，调用方必须感知错误")
        } catch {
            #expect(error is 分类服务测试错误)
        }

        #expect(model.categories.map(\.id) == [1, 2])
        #expect(model.counts == [1: 3, 2: 4])
        #expect(model.errorMessage != nil)
    }
}

private func 分类(
    id: Int,
    name: String = "分类",
    sortOrder: Int,
    isActive: Bool = true
) -> ArticleCategory {
    ArticleCategory(
        id: id,
        name: name,
        sortOrder: sortOrder,
        isActive: isActive
    )
}

private enum 分类服务测试错误: Error, Sendable {
    case 缺少响应
}

private actor 分类服务桩: CategoryCatalogServicing {
    private var 列表响应: [Result<CategoriesResponse, 分类服务测试错误>]
    private var 创建响应: [Result<CategoryResponse, 分类服务测试错误>]
    private var 更新响应: [Result<CategoryResponse, 分类服务测试错误>]
    private var 排序响应: [Result<CategoryReorderResponse, 分类服务测试错误>]
    private var 删除响应: [Result<DeleteCategoryResponse, 分类服务测试错误>]
    private var 合并响应: [Result<Void, 分类服务测试错误>]
    private var 优化响应: [Result<CategoryOptimizeResponse, 分类服务测试错误>]

    init(
        列表响应: [Result<CategoriesResponse, 分类服务测试错误>] = [],
        创建响应: [Result<CategoryResponse, 分类服务测试错误>] = [],
        更新响应: [Result<CategoryResponse, 分类服务测试错误>] = [],
        排序响应: [Result<CategoryReorderResponse, 分类服务测试错误>] = [],
        删除响应: [Result<DeleteCategoryResponse, 分类服务测试错误>] = [],
        合并响应: [Result<Void, 分类服务测试错误>] = [],
        优化响应: [Result<CategoryOptimizeResponse, 分类服务测试错误>] = []
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
        self.更新响应 = 更新响应
        self.排序响应 = 排序响应
        self.删除响应 = 删除响应
        self.合并响应 = 合并响应
        self.优化响应 = 优化响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        guard !列表响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 列表响应.removeFirst().get()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        guard !创建响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 创建响应.removeFirst().get()
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        guard !更新响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 更新响应.removeFirst().get()
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        guard !排序响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 排序响应.removeFirst().get()
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        guard !删除响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 删除响应.removeFirst().get()
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        guard !合并响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        try 合并响应.removeFirst().get()
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        guard !优化响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 优化响应.removeFirst().get()
    }
}

private actor 延迟分类服务桩: CategoryCatalogServicing {
    private let 旧用户响应: CategoriesResponse
    private let 新用户响应: CategoriesResponse
    private var 列表请求次数 = 0
    private var 第一次请求已开始: CheckedContinuation<Void, Never>?
    private var 旧用户响应放行: CheckedContinuation<Void, Never>?

    init(旧用户响应: CategoriesResponse, 新用户响应: CategoriesResponse) {
        self.旧用户响应 = 旧用户响应
        self.新用户响应 = 新用户响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求次数 += 1
        if 列表请求次数 == 1 {
            第一次请求已开始?.resume()
            第一次请求已开始 = nil
            await withCheckedContinuation { continuation in
                旧用户响应放行 = continuation
            }
            return 旧用户响应
        }
        return 新用户响应
    }

    func 等待第一次列表请求开始() async {
        if 列表请求次数 > 0 { return }
        await withCheckedContinuation { continuation in
            第一次请求已开始 = continuation
        }
    }

    func 放行旧用户响应() {
        旧用户响应放行?.resume()
        旧用户响应放行 = nil
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 分类服务测试错误.缺少响应
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 分类服务测试错误.缺少响应
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 分类服务测试错误.缺少响应
    }
}

private actor 旧读取与创建交错服务桩: CategoryCatalogServicing {
    private let 初始目录: CategoriesResponse
    private let 旧目录结果: Result<CategoriesResponse, 分类服务测试错误>
    private let 新分类: ArticleCategory
    private var 列表请求次数 = 0
    private var 第二次请求已开始: CheckedContinuation<Void, Never>?
    private var 旧目录响应放行: CheckedContinuation<Void, Never>?

    init(
        初始目录: CategoriesResponse,
        旧目录结果: Result<CategoriesResponse, 分类服务测试错误>,
        新分类: ArticleCategory
    ) {
        self.初始目录 = 初始目录
        self.旧目录结果 = 旧目录结果
        self.新分类 = 新分类
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求次数 += 1
        if 列表请求次数 == 1 {
            return 初始目录
        }

        第二次请求已开始?.resume()
        第二次请求已开始 = nil
        await withCheckedContinuation { continuation in
            旧目录响应放行 = continuation
        }
        return try 旧目录结果.get()
    }

    func 等待第二次列表请求开始() async {
        if 列表请求次数 >= 2 { return }
        await withCheckedContinuation { continuation in
            第二次请求已开始 = continuation
        }
    }

    func 放行旧目录响应() {
        旧目录响应放行?.resume()
        旧目录响应放行 = nil
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        CategoryResponse(category: 新分类)
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 分类服务测试错误.缺少响应
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 分类服务测试错误.缺少响应
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 分类服务测试错误.缺少响应
    }
}

@MainActor
private final class 最近分类存储桩: CategoryRecentStoring {
    var 记录: [Int: [Int]]

    init(记录: [Int: [Int]] = [:]) {
        self.记录 = 记录
    }

    func load(userID: Int) -> [Int] {
        记录[userID] ?? []
    }

    func save(_ categoryIDs: [Int], userID: Int) {
        记录[userID] = categoryIDs
    }
}
