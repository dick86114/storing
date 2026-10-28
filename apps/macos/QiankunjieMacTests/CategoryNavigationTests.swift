import Foundation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieLibrary
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryNavigationTests {
    @Test func 选择分类会切换到归档并同步资料库筛选() async {
        let 分类目录 = 创建分类目录(列表响应: [
            CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 4]
            ),
        ])
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )

        model.selectCategory(21)

        #expect(model.destination == .archive)
        #expect(model.selectedCategoryID == 21)
        #expect(model.libraryModel.categoryId == 21)
        #expect(model.libraryModel.view == .archive)

        await 资料库仓库.等待请求数(1)
        let 查询 = await 资料库仓库.最近查询()
        #expect(查询?.view == .archive)
        #expect(查询?.categoryId == 21)
    }

    @Test func 选择其他资料库栏目会清空当前分类() async {
        let 分类目录 = 创建分类目录(列表响应: [
            CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 4]
            ),
        ])
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .archive,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        model.selectCategory(21)
        await 资料库仓库.等待请求数(1)

        model.selectDestination(.favorites)

        #expect(model.destination == .favorites)
        #expect(model.selectedCategoryID == nil)
        #expect(model.libraryModel.categoryId == nil)
        #expect(model.libraryModel.view == .favorites)
    }

    @Test func 分类中提交和清除搜索会同步清空分类筛选() async {
        let 分类目录 = 创建分类目录(列表响应: [
            CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 4]
            ),
        ])
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let model = 创建应用模型(
            用户ID: 9,
            目的地: .archive,
            资料库仓库: 导航资料库仓库(),
            分类目录: 分类目录
        )
        model.selectCategory(21)
        model.libraryModel.searchDraft = "产品设计"

        model.submitLibrarySearch()

        #expect(model.selectedCategoryID == nil)
        #expect(model.libraryModel.categoryId == nil)
        #expect(model.libraryModel.appliedSearchText == "产品设计")

        model.clearLibrarySearch()

        #expect(model.selectedCategoryID == nil)
        #expect(model.libraryModel.categoryId == nil)
        #expect(model.libraryModel.appliedSearchText.isEmpty)
    }

    @Test func 分类中清除未提交搜索草稿会保留当前分类() async {
        let 分类目录 = 创建分类目录(列表响应: [
            CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 4]
            ),
        ])
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let model = 创建应用模型(
            用户ID: 9,
            目的地: .archive,
            资料库仓库: 导航资料库仓库(),
            分类目录: 分类目录
        )
        model.selectCategory(21)
        model.libraryModel.searchDraft = "尚未提交的产品设计"

        model.clearLibrarySearch()

        #expect(model.selectedCategoryID == 21)
        #expect(model.libraryModel.categoryId == 21)
        #expect(model.libraryModel.searchDraft.isEmpty)
        #expect(model.libraryModel.appliedSearchText.isEmpty)
    }

    @Test func 多个资料库变更信号会去抖为一次分类目录刷新() async {
        let service = 导航分类服务(
            列表响应: [
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 1]
                ),
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 3]
                ),
            ]
        )
        let 分类目录 = CategoryCatalogModel(
            service: service,
            recentStore: 导航最近分类存储()
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .archive,
            资料库仓库: 导航资料库仓库(),
            分类目录: 分类目录
        )

        model.libraryModel.onCatalogAffectingChange?()
        model.libraryModel.onCatalogAffectingChange?()
        await service.等待列表请求次数(2)
        try? await Task.sleep(for: .milliseconds(350))

        #expect(await service.列表请求次数() == 2)
        #expect(分类目录.count(for: 21) == 3)
    }

    @Test func 普通阅读器变更不刷新分类而分类变更会刷新() async {
        let service = 导航分类服务(
            列表响应: [
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 1]
                ),
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 3]
                ),
            ]
        )
        let 分类目录 = CategoryCatalogModel(
            service: service,
            recentStore: 导航最近分类存储()
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )

        model.handleLibraryDidChange()
        await 资料库仓库.等待请求数(1)
        try? await Task.sleep(for: .milliseconds(300))
        #expect(await service.列表请求次数() == 1)

        model.handleCategoryCatalogAffectingChange()
        await 资料库仓库.等待请求数(2)
        await service.等待列表请求次数(2)

        #expect(await service.列表请求次数() == 2)
        #expect(分类目录.count(for: 21) == 3)
    }

    @Test func 分类被删除后当前筛选自动回到全部归档() async {
        let 分类目录 = 创建分类目录(列表响应: [
            CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 4]
            ),
            CategoriesResponse(categories: [], counts: [:]),
        ])
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .archive,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        model.selectCategory(21)
        await 资料库仓库.等待请求数(1)

        await 分类目录.load()

        #expect(model.destination == .archive)
        #expect(model.selectedCategoryID == nil)
        #expect(model.libraryModel.categoryId == nil)
        #expect(model.libraryModel.view == .archive)

        await 资料库仓库.等待请求数(2)
        let 查询 = await 资料库仓库.最近查询()
        #expect(查询?.view == .archive)
        #expect(查询?.categoryId == nil)
    }

    @Test func 侧栏创建分类后自动进入新分类归档() async {
        let 新分类 = 分类(id: 22, name: "产品设计", sortOrder: 20)
        let (分类目录, 分类服务) = 创建分类目录与导航服务(
            列表响应: [
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 4]
                ),
            ],
            创建响应: [.success(CategoryResponse(category: 新分类))]
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        var 草稿 = CategoryDraft()
        草稿.name = " 产品设计 "

        let 创建结果 = await model.createCategoryAndSelect(草稿)

        #expect(创建结果 == 新分类)
        #expect(model.destination == .archive)
        #expect(model.selectedCategoryID == 新分类.id)
        #expect(model.libraryModel.categoryId == 新分类.id)
        #expect(model.libraryModel.view == .archive)
        #expect(分类目录.categories.contains(新分类))
        #expect(await 分类服务.已创建分类名称() == ["产品设计"])

        await 资料库仓库.等待请求数(1)
        let 查询 = await 资料库仓库.最近查询()
        #expect(查询?.view == .archive)
        #expect(查询?.categoryId == 新分类.id)
    }

    @Test func 创建成功但选择失败时保留分类并返回错误() async {
        let 不可用分类 = 分类(
            id: 22,
            name: "产品设计",
            sortOrder: 20,
            isActive: false
        )
        let (分类目录, _) = 创建分类目录与导航服务(
            列表响应: [
                CategoriesResponse(
                    categories: [分类(id: 21, sortOrder: 10)],
                    counts: ["21": 4]
                ),
            ],
            创建响应: [.success(CategoryResponse(category: 不可用分类))]
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        var 草稿 = CategoryDraft()
        草稿.name = "产品设计"

        let 创建结果 = await model.createCategoryAndSelect(草稿)

        #expect(创建结果 == nil)
        #expect(分类目录.categories.contains(不可用分类))
        #expect(分类目录.errorMessage == "分类已创建，但无法进入新分类，请稍后重试")
        #expect(model.destination == .favorites)
        #expect(model.selectedCategoryID == nil)
        #expect(model.libraryModel.categoryId == nil)
        #expect(await 资料库仓库.请求次数() == 0)
    }

    @Test func 同名分类不会重复提交并显示可恢复错误() async {
        let 已有分类 = 分类(id: 21, name: "产品设计", sortOrder: 10)
        let (分类目录, 分类服务) = 创建分类目录与导航服务(
            列表响应: [
                CategoriesResponse(
                    categories: [已有分类],
                    counts: ["21": 4]
                ),
            ],
            创建响应: []
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        var 草稿 = CategoryDraft()
        草稿.name = " 产品设计 "

        let 创建结果 = await model.createCategoryAndSelect(草稿)

        #expect(创建结果 == nil)
        #expect(分类目录.categories == [已有分类])
        #expect(分类目录.errorMessage == "已存在同名启用分类，请换一个名称")
        #expect(await 分类服务.已创建分类名称().isEmpty == true)
        #expect(model.destination == .favorites)
    }

    @Test func 创建中切换用户后旧请求静默失效() async {
        let 旧用户分类 = 分类(id: 11, name: "旧分类", sortOrder: 10)
        let 新用户分类 = 分类(id: 21, name: "新用户分类", sortOrder: 10)
        let 分类服务 = 用户切换分类服务(
            列表响应: [
                CategoriesResponse(categories: [], counts: [:]),
                CategoriesResponse(categories: [新用户分类], counts: ["21": 2]),
            ],
            新用户创建结果: 分类(id: 22, name: "新用户新建", sortOrder: 20)
        )
        let 分类目录 = CategoryCatalogModel(
            service: 分类服务,
            recentStore: 导航最近分类存储()
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        var 草稿 = CategoryDraft()
        草稿.name = 旧用户分类.name

        let 旧创建任务 = Task { @MainActor in
            await model.createCategoryAndSelect(草稿)
        }
        await 分类服务.等待首次创建开始()
        await 切换导航用户(
            model,
            用户ID: 10,
            分类目录: 分类目录
        )

        await 分类服务.完成首次创建(
            with: .failure(AppError.server)
        )
        let 旧创建结果 = await 旧创建任务.value

        #expect(旧创建结果 == nil)
        #expect(分类目录.userID == 10)
        #expect(分类目录.categories == [新用户分类])
        #expect(分类目录.errorMessage == nil)
        #expect(model.selectedCategoryID == nil)
        #expect(model.destination == .favorites)
        #expect(await 分类服务.已创建分类名称() == [旧用户分类.name])
    }

    @Test func 创建中切换后新用户可以立即创建() async {
        let 新用户已有分类 = 分类(id: 21, name: "新用户分类", sortOrder: 10)
        let 新用户新建分类 = 分类(id: 22, name: "新用户新建", sortOrder: 20)
        let 分类服务 = 用户切换分类服务(
            列表响应: [
                CategoriesResponse(categories: [], counts: [:]),
                CategoriesResponse(categories: [新用户已有分类], counts: ["21": 2]),
            ],
            新用户创建结果: 新用户新建分类
        )
        let 分类目录 = CategoryCatalogModel(
            service: 分类服务,
            recentStore: 导航最近分类存储()
        )
        分类目录.prepareUser(userID: 9)
        await 分类目录.load()

        let 资料库仓库 = 导航资料库仓库()
        let model = 创建应用模型(
            用户ID: 9,
            目的地: .favorites,
            资料库仓库: 资料库仓库,
            分类目录: 分类目录
        )
        var 旧草稿 = CategoryDraft()
        旧草稿.name = "旧用户分类"

        let 旧创建任务 = Task { @MainActor in
            await model.createCategoryAndSelect(旧草稿)
        }
        await 分类服务.等待首次创建开始()
        await 切换导航用户(
            model,
            用户ID: 10,
            分类目录: 分类目录
        )

        var 新草稿 = CategoryDraft()
        新草稿.name = 新用户新建分类.name
        let 新创建结果 = await model.createCategoryAndSelect(新草稿)

        #expect(新创建结果 == 新用户新建分类)
        #expect(model.destination == .archive)
        #expect(model.selectedCategoryID == 新用户新建分类.id)
        #expect(分类目录.activeCategories.contains(新用户新建分类))

        await 分类服务.完成首次创建(
            with: .failure(AppError.server)
        )
        let 旧创建结果 = await 旧创建任务.value

        #expect(旧创建结果 == nil)
        #expect(分类目录.errorMessage == nil)
        #expect(model.selectedCategoryID == 新用户新建分类.id)
        #expect(分类目录.activeCategories.contains(新用户新建分类))
        #expect(await 分类服务.已创建分类名称() == [旧草稿.name, 新草稿.name])
    }
}

@MainActor
private func 创建分类目录(
    列表响应: [CategoriesResponse]
) -> CategoryCatalogModel {
    CategoryCatalogModel(
        service: 导航分类服务(列表响应: 列表响应),
        recentStore: 导航最近分类存储()
    )
}

@MainActor
private func 创建分类目录与导航服务(
    列表响应: [CategoriesResponse],
    创建响应: [Result<CategoryResponse, 导航测试错误>]
) -> (CategoryCatalogModel, 导航分类服务) {
    let 分类服务 = 导航分类服务(
        列表响应: 列表响应,
        创建响应: 创建响应
    )
    let 分类目录 = CategoryCatalogModel(
        service: 分类服务,
        recentStore: 导航最近分类存储()
    )
    return (分类目录, 分类服务)
}

@MainActor
private func 创建应用模型(
    用户ID: Int,
    目的地: AppDestination,
    资料库仓库: 导航资料库仓库,
    分类目录: CategoryCatalogModel
) -> AppModel {
    let authModel = AuthModel(
        repository: AuthRepository(
            client: 导航认证客户端(),
            store: 导航会话存储()
        )
    )
    let model = AppModel(
        authModel: authModel,
        libraryModel: LibraryModel(
            repository: 资料库仓库,
            cache: EmptyLibraryCache(),
            userID: 用户ID,
            view: 目的地.libraryView ?? .archive
        ),
        categoryCatalog: 分类目录
    )
    model.user = AuthenticatedUser(
        id: 用户ID,
        username: "reader",
        role: "reader",
        status: "active"
    )
    model.destination = 目的地
    return model
}

@MainActor
private func 切换导航用户(
    _ model: AppModel,
    用户ID: Int,
    分类目录: CategoryCatalogModel
) async {
    model.user = AuthenticatedUser(
        id: 用户ID,
        username: "reader-\(用户ID)",
        role: "reader",
        status: "active"
    )
    model.destination = .favorites
    model.libraryModel.prepareUser(
        userID: 用户ID,
        view: .favorites
    )
    分类目录.prepareUser(userID: 用户ID)
    await 分类目录.load()
}

private actor 导航分类服务: CategoryCatalogServicing {
    private var 列表响应: [CategoriesResponse]
    private var 创建响应: [Result<CategoryResponse, 导航测试错误>]
    private var 创建名称记录: [String] = []
    private var 列表请求计数 = 0
    private var 列表请求等待者: [Int: [CheckedContinuation<Void, Never>]] = [:]

    init(
        列表响应: [CategoriesResponse],
        创建响应: [Result<CategoryResponse, 导航测试错误>] = []
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        let 已达成的等待者 = 列表请求等待者.keys.filter { $0 <= 列表请求计数 }
        for 数量 in 已达成的等待者 {
            列表请求等待者.removeValue(forKey: 数量)?.forEach { $0.resume() }
        }
        guard !列表响应.isEmpty else { throw 导航测试错误.缺少分类响应 }
        return 列表响应.removeFirst()
    }

    func 等待列表请求次数(_ 数量: Int) async {
        if 列表请求计数 >= 数量 { return }
        await withCheckedContinuation { continuation in
            列表请求等待者[数量, default: []].append(continuation)
        }
    }

    func 列表请求次数() -> Int {
        列表请求计数
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建名称记录.append(request.name ?? "")
        guard !创建响应.isEmpty else { throw 导航测试错误.未实现分类操作 }
        return try 创建响应.removeFirst().get()
    }

    func 已创建分类名称() -> [String] {
        创建名称记录
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 导航测试错误.未实现分类操作
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 导航测试错误.未实现分类操作
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 导航测试错误.未实现分类操作
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 导航测试错误.未实现分类操作
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 导航测试错误.未实现分类操作
    }
}

private actor 用户切换分类服务: CategoryCatalogServicing {
    private var 列表响应: [CategoriesResponse]
    private let 新用户创建结果: ArticleCategory
    private var 创建名称记录: [String] = []
    private var 首次创建已开始 = false
    private var 首次创建开始等待者: CheckedContinuation<Void, Never>?
    private var 首次创建结果等待者: CheckedContinuation<Result<CategoryResponse, AppError>, Never>?

    init(
        列表响应: [CategoriesResponse],
        新用户创建结果: ArticleCategory
    ) {
        self.列表响应 = 列表响应
        self.新用户创建结果 = 新用户创建结果
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        guard !列表响应.isEmpty else { throw 导航测试错误.缺少分类响应 }
        return 列表响应.removeFirst()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建名称记录.append(request.name ?? "")
        if 创建名称记录.count == 1 {
            首次创建已开始 = true
            首次创建开始等待者?.resume()
            首次创建开始等待者 = nil
            let result = await withCheckedContinuation { continuation in
                首次创建结果等待者 = continuation
            }
            return try result.get()
        }
        return CategoryResponse(category: 新用户创建结果)
    }

    func 等待首次创建开始() async {
        if 首次创建已开始 { return }
        await withCheckedContinuation { continuation in
            首次创建开始等待者 = continuation
        }
    }

    func 完成首次创建(with result: Result<CategoryResponse, AppError>) {
        首次创建结果等待者?.resume(returning: result)
        首次创建结果等待者 = nil
    }

    func 已创建分类名称() -> [String] {
        创建名称记录
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 导航测试错误.未实现分类操作
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 导航测试错误.未实现分类操作
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 导航测试错误.未实现分类操作
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 导航测试错误.未实现分类操作
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 导航测试错误.未实现分类操作
    }
}

@MainActor
private final class 导航最近分类存储: CategoryRecentStoring {
    private var 分类ID: [Int: [Int]] = [:]

    func load(userID: Int) -> [Int] {
        分类ID[userID] ?? []
    }

    func save(_ categoryIDs: [Int], userID: Int) {
        分类ID[userID] = categoryIDs
    }
}

private actor 导航资料库仓库: LibraryLoading {
    private var 查询记录: [LibraryQuery] = []

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        查询记录.append(query)
        return ArticleListPage(
            articles: [],
            total: 0,
            page: 1,
            perPage: 20,
            totalPages: 0
        )
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 0, favorites: 0, archive: 0, published: 0)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        []
    }

    func 等待请求数(_ 数量: Int) async {
        while 查询记录.count < 数量 {
            await Task.yield()
        }
    }

    func 最近查询() -> LibraryQuery? {
        查询记录.last
    }

    func 请求次数() -> Int {
        查询记录.count
    }
}

private struct 导航认证客户端: AuthClient, Sendable {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        throw AppError.server
    }

    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.server
    }

    func logout(refreshToken: String) async throws {}

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.server
    }
}

private struct 导航会话存储: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}

private enum 导航测试错误: Error {
    case 缺少分类响应
    case 未实现分类操作
}

private func 分类(
    id: Int,
    name: String? = nil,
    sortOrder: Int,
    isActive: Bool = true
) -> ArticleCategory {
    ArticleCategory(
        id: id,
        name: name ?? "分类 \(id)",
        color: "#2F6A4F",
        sortOrder: sortOrder,
        isActive: isActive
    )
}

private extension AppDestination {
    var libraryView: LibraryView? {
        switch self {
        case .inbox: .inbox
        case .favorites: .favorites
        case .archive: .archive
        case .published: .published
        default: nil
        }
    }
}
