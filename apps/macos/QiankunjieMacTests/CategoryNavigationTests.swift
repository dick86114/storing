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

private actor 导航分类服务: CategoryCatalogServicing {
    private var 列表响应: [CategoriesResponse]
    private var 创建响应: [Result<CategoryResponse, 导航测试错误>]
    private var 创建名称记录: [String] = []

    init(
        列表响应: [CategoriesResponse],
        创建响应: [Result<CategoryResponse, 导航测试错误>] = []
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        guard !列表响应.isEmpty else { throw 导航测试错误.缺少分类响应 }
        return 列表响应.removeFirst()
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
