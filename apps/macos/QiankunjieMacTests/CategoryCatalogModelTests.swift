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

    @Test func 只有加载成功后才标记可信目录且切换用户会清除标记() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 21, sortOrder: 10)],
                counts: ["21": 3]
            )),
            .failure(.缺少响应),
            .failure(.缺少响应),
        ])
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )

        #expect(!model.hasLoadedCatalog)
        model.prepareUser(userID: 7)
        #expect(!model.hasLoadedCatalog)

        await model.load()
        #expect(model.hasLoadedCatalog)

        await model.load()
        #expect(model.hasLoadedCatalog)

        model.prepareUser(userID: 8)
        #expect(!model.hasLoadedCatalog)

        await model.load()
        #expect(!model.hasLoadedCatalog)
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

    @Test func 强制刷新遇到旧revision飞行请求会在完成后补发新请求() async throws {
        let service = 旧读取与创建交错服务桩(
            初始目录: CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 2]
            ),
            旧目录结果: .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 2]
            )),
            新分类: 分类(id: 2, name: "设计", sortOrder: 20),
            后续目录: CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, name: "设计", sortOrder: 20),
                    分类(id: 3, name: "研究", sortOrder: 30),
                ],
                counts: ["1": 2, "2": 0, "3": 1]
            )
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
        let 强制刷新 = Task { @MainActor in
            await model.load()
        }
        await Task.yield()

        #expect(await service.列表请求次数() == 2)

        await service.放行旧目录响应()
        await 旧读取.value
        await 强制刷新.value

        #expect(await service.列表请求次数() == 3)
        #expect(model.categories.map(\.id) == [1, 2, 3])
        #expect(model.counts == [1: 2, 2: 0, 3: 1])
    }

    @Test func 并发正常刷新只会发起一次请求() async {
        let service = 并发目录服务桩(
            响应: CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 3]
            )
        )
        var now = Date(timeIntervalSince1970: 1_000)
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩(),
            refreshTTL: 60,
            now: { now }
        )
        model.prepareUser(userID: 7)

        let 首次加载 = Task { @MainActor in
            await model.load()
        }
        await service.等待列表请求次数(1)
        await service.放行列表响应()
        await 首次加载.value
        now = now.addingTimeInterval(61)

        let 第一次刷新 = Task { @MainActor in
            await model.refreshIfNeeded()
        }
        await service.等待列表请求次数(2)
        let 第二次刷新 = Task { @MainActor in
            await model.refreshIfNeeded()
        }
        await Task.yield()

        #expect(await service.列表请求次数() == 2)

        await service.放行列表响应()
        await 第一次刷新.value
        await 第二次刷新.value

        #expect(await service.列表请求次数() == 2)
    }

    @Test func 新鲜缓存不请求而TTL过期会静默刷新() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 3]
            )),
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 5]
            )),
        ])
        var now = Date(timeIntervalSince1970: 1_000)
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩(),
            refreshTTL: 60,
            now: { now }
        )
        model.prepareUser(userID: 7)
        await model.load()

        now = now.addingTimeInterval(30)
        await model.refreshIfNeeded()
        #expect(await service.列表请求次数() == 1)
        #expect(model.count(for: 1) == 3)

        now = now.addingTimeInterval(31)
        await model.refreshIfNeeded()
        #expect(await service.列表请求次数() == 2)
        #expect(model.count(for: 1) == 5)
    }

    @Test func 分类变更会标记目录需要刷新() async throws {
        let service = 分类服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, sortOrder: 10)],
                    counts: ["1": 3]
                )),
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, sortOrder: 10),
                        分类(id: 2, name: "设计", sortOrder: 20),
                    ],
                    counts: ["1": 3, "2": 4]
                )),
            ],
            创建响应: [
                .success(CategoryResponse(category: 分类(id: 2, name: "设计", sortOrder: 20))),
            ]
        )
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩(),
            refreshTTL: 60,
            now: { Date(timeIntervalSince1970: 1_000) }
        )
        model.prepareUser(userID: 7)
        await model.load()
        var draft = CategoryDraft()
        draft.name = "设计"
        _ = try await model.create(draft)

        await model.refreshIfNeeded()

        #expect(await service.列表请求次数() == 2)
        #expect(model.count(for: 2) == 4)
    }

    @Test func 刷新失败后下一次刷新如果需要会立即重试() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 3]
            )),
            .failure(.缺少响应),
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 7]
            )),
        ])
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩(),
            refreshTTL: 60,
            now: { Date(timeIntervalSince1970: 1_000) }
        )
        model.prepareUser(userID: 7)
        await model.load()
        await model.load()
        #expect(model.errorMessage != nil)

        await model.refreshIfNeeded()

        #expect(await service.列表请求次数() == 3)
        #expect(model.errorMessage == nil)
        #expect(model.count(for: 1) == 7)
    }

    @Test func 服务端同名冲突保留草稿并显示原始消息() async {
        let 服务端冲突消息 = "已存在同名启用分类，请换一个名称"
        let service = 分类服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, name: "工程", sortOrder: 10)],
                    counts: ["1": 2]
                )),
            ],
            创建错误: .categoryConflict(message: 服务端冲突消息)
        )
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )

        model.prepareUser(userID: 5)
        await model.load()
        var draft = CategoryDraft()
        draft.name = "产品设计"

        do {
            _ = try await model.create(draft)
            Issue.record("服务端同名冲突必须向调用方抛错")
        } catch {
            #expect(error as? AppError == .categoryConflict(message: 服务端冲突消息))
        }

        #expect(draft.name == "产品设计")
        #expect(model.categories.map(\.id) == [1])
        #expect(model.errorMessage == 服务端冲突消息)
    }

    @Test func 合并成功但刷新失败会标记已提交并保留软停用目录() async throws {
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
            Issue.record("服务端合并成功但刷新失败时，调用方必须感知部分成功")
        } catch {
            #expect(error as? CategoryCatalogMutationError == .mergeCommittedButRefreshFailed)
        }

        #expect(model.categories.map(\.id) == [1, 2])
        #expect(model.categories.first { $0.id == 1 }?.isActive == false)
        #expect(model.activeCategories.map(\.id) == [2])
        #expect(model.counts == [1: 0, 2: 7])
        #expect(model.errorMessage != nil)
    }

    @Test func 可信缓存下刷新如果需要不会重复请求目录() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 3]
            )),
        ])
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )

        model.prepareUser(userID: 7)
        await model.load()
        await model.refreshIfNeeded()

        #expect(await service.列表请求次数() == 1)
        #expect(model.count(for: 1) == 3)
    }

    @Test func 并发目录刷新会等待同一个请求() async {
        let service = 并发目录服务桩(
            响应: CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10)],
                counts: ["1": 3]
            )
        )
        let model = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        model.prepareUser(userID: 7)

        let 第一次刷新 = Task { @MainActor in
            await model.load()
        }
        await service.等待列表请求开始()
        let 第二次刷新 = Task { @MainActor in
            await model.load()
        }
        await Task.yield()

        #expect(await service.列表请求次数() == 1)

        await service.放行列表响应()
        await 第一次刷新.value
        await 第二次刷新.value

        #expect(await service.列表请求次数() == 1)
        #expect(model.count(for: 1) == 3)
    }

    @Test func 排序前拒绝重复缺失或越界顺序() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [分类(id: 1, sortOrder: 10), 分类(id: 2, sortOrder: 20)],
                counts: [:]
            )),
        ])
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())
        model.prepareUser(userID: 7)
        await model.load()

        for 非法顺序 in [[1], [1, 1], [1, 2, 99]] {
            do {
                try await model.reorder(categoryIDs: 非法顺序)
                Issue.record("非法分类顺序不应提交：\(非法顺序)")
            } catch {
                // 预期在本地校验阶段失败。
            }
        }

        #expect(await service.排序请求快照().isEmpty)
        #expect(model.categories.map(\.id) == [1, 2])
    }

    @Test func 排序前拒绝改变系统分类位置() async {
        let service = 分类服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20, isSystem: true),
                    分类(id: 3, sortOrder: 30),
                ],
                counts: [:]
            )),
        ])
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())
        model.prepareUser(userID: 7)
        await model.load()

        do {
            try await model.reorder(categoryIDs: [3, 2, 1])
            Issue.record("移动系统分类位置时必须在发请求前失败")
        } catch {
            // 预期在本地校验阶段失败。
        }

        #expect(await service.排序请求快照().isEmpty)
        #expect(model.errorMessage == "系统分类必须保持固定位置")
    }

    @Test func 排序进行中再次排序不会发出第二次请求() async throws {
        let service = 排序闸门分类服务桩(
            目录: CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20),
                    分类(id: 3, sortOrder: 30),
                ],
                counts: [:]
            ),
            排序结果: CategoryReorderResponse(categories: [
                分类(id: 2, sortOrder: 10),
                分类(id: 1, sortOrder: 20),
                分类(id: 3, sortOrder: 30),
            ])
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())
        model.prepareUser(userID: 7)
        await model.load()

        let 第一次排序 = Task { @MainActor in
            try await model.reorder(categoryIDs: [2, 1, 3])
        }
        await service.等待第一次排序开始()
        let 第二次排序 = Task { @MainActor in
            try await model.reorder(categoryIDs: [3, 1, 2])
        }
        await service.等待排序请求数至少为(2, 超时毫秒: 200)

        #expect(await service.排序请求快照() == [[2, 1, 3]])

        await service.放行排序响应()
        try await 第一次排序.value
        do {
            try await 第二次排序.value
            Issue.record("排序进行中的第二次请求必须被拒绝")
        } catch {
            // 预期在本地并发校验阶段失败。
        }
    }

    @Test func 排序请求等待响应时立即采用乐观顺序() async throws {
        let service = 排序闸门分类服务桩(
            目录: CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20),
                    分类(id: 3, sortOrder: 30),
                ],
                counts: [:]
            ),
            排序结果: CategoryReorderResponse(categories: [
                分类(id: 2, sortOrder: 10),
                分类(id: 1, sortOrder: 20),
                分类(id: 3, sortOrder: 30),
            ])
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())
        model.prepareUser(userID: 7)
        await model.load()

        let 排序任务 = Task { @MainActor in
            try await model.reorder(categoryIDs: [2, 1, 3])
        }
        await service.等待第一次排序开始()

        #expect(model.categories.map(\.id) == [2, 1, 3])
        #expect(model.isMutating)

        await service.放行排序响应()
        try await 排序任务.value

        #expect(model.categories.map(\.id) == [2, 1, 3])
    }

    @Test func 排序失败会恢复等待期间的原始顺序() async {
        let service = 排序闸门分类服务桩(
            目录: CategoriesResponse(
                categories: [
                    分类(id: 1, sortOrder: 10),
                    分类(id: 2, sortOrder: 20),
                    分类(id: 3, sortOrder: 30),
                ],
                counts: [:]
            ),
            排序失败: .network
        )
        let model = CategoryCatalogModel(service: service, recentStore: 最近分类存储桩())
        model.prepareUser(userID: 7)
        await model.load()

        let 排序任务 = Task { @MainActor in
            do {
                try await model.reorder(categoryIDs: [2, 1, 3])
                Issue.record("排序服务失败时不应报告成功")
            } catch {
                // 预期由目录模型回报服务错误。
            }
        }
        await service.等待第一次排序开始()

        #expect(model.categories.map(\.id) == [2, 1, 3])

        await service.放行排序响应()
        await 排序任务.value

        #expect(model.categories.map(\.id) == [1, 2, 3])
        #expect(model.errorMessage != nil)
    }
}

private func 分类(
    id: Int,
    name: String = "分类",
    sortOrder: Int,
    isActive: Bool = true,
    isSystem: Bool = false
) -> ArticleCategory {
    ArticleCategory(
        id: id,
        name: name,
        sortOrder: sortOrder,
        isActive: isActive,
        isSystem: isSystem
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
    private let 创建错误: AppError?
    private var 列表请求计数 = 0
    private var 排序请求: [[Int]] = []

    init(
        列表响应: [Result<CategoriesResponse, 分类服务测试错误>] = [],
        创建响应: [Result<CategoryResponse, 分类服务测试错误>] = [],
        更新响应: [Result<CategoryResponse, 分类服务测试错误>] = [],
        排序响应: [Result<CategoryReorderResponse, 分类服务测试错误>] = [],
        删除响应: [Result<DeleteCategoryResponse, 分类服务测试错误>] = [],
        合并响应: [Result<Void, 分类服务测试错误>] = [],
        优化响应: [Result<CategoryOptimizeResponse, 分类服务测试错误>] = [],
        创建错误: AppError? = nil
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
        self.更新响应 = 更新响应
        self.排序响应 = 排序响应
        self.删除响应 = 删除响应
        self.合并响应 = 合并响应
        self.优化响应 = 优化响应
        self.创建错误 = 创建错误
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        guard !列表响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 列表响应.removeFirst().get()
    }

    func 列表请求次数() -> Int {
        列表请求计数
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        if let 创建错误 { throw 创建错误 }
        guard !创建响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 创建响应.removeFirst().get()
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        guard !更新响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 更新响应.removeFirst().get()
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        排序请求.append(categoryIDs)
        guard !排序响应.isEmpty else { throw 分类服务测试错误.缺少响应 }
        return try 排序响应.removeFirst().get()
    }

    func 排序请求快照() -> [[Int]] {
        排序请求
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

private actor 并发目录服务桩: CategoryCatalogServicing {
    private let 响应: CategoriesResponse
    private var 列表请求计数 = 0
    private var 等待响应放行: CheckedContinuation<Void, Never>?

    init(响应: CategoriesResponse) {
        self.响应 = 响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        await withCheckedContinuation { continuation in
            等待响应放行 = continuation
        }
        return 响应
    }

    func 等待列表请求开始() async {
        await 等待列表请求次数(1)
    }

    func 等待列表请求次数(_ count: Int) async {
        while 列表请求计数 < count {
            await Task.yield()
        }
    }

    func 放行列表响应() {
        等待响应放行?.resume()
        等待响应放行 = nil
    }

    func 列表请求次数() -> Int {
        列表请求计数
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

private actor 排序闸门分类服务桩: CategoryCatalogServicing {
    private let 目录: CategoriesResponse
    private let 排序结果: Result<CategoryReorderResponse, AppError>
    private var 排序请求: [[Int]] = []
    private var 第一次排序开始: CheckedContinuation<Void, Never>?
    private var 待放行排序: [CheckedContinuation<Void, Never>] = []

    init(目录: CategoriesResponse, 排序结果: CategoryReorderResponse) {
        self.目录 = 目录
        self.排序结果 = .success(排序结果)
    }

    init(目录: CategoriesResponse, 排序失败: AppError) {
        self.目录 = 目录
        self.排序结果 = .failure(排序失败)
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        目录
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        排序请求.append(categoryIDs)
        if 排序请求.count == 1 {
            第一次排序开始?.resume()
            第一次排序开始 = nil
        }
        await withCheckedContinuation { continuation in
            待放行排序.append(continuation)
        }
        return try 排序结果.get()
    }

    func 等待第一次排序开始() async {
        guard 排序请求.isEmpty else { return }
        await withCheckedContinuation { continuation in
            第一次排序开始 = continuation
        }
    }

    func 等待排序请求数至少为(_ count: Int, 超时毫秒: Int) async {
        let 轮询次数 = max(1, 超时毫秒 / 10)
        for _ in 0..<轮询次数 {
            if 排序请求.count >= count { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    func 排序请求快照() -> [[Int]] {
        排序请求
    }

    func 放行排序响应() {
        let continuations = 待放行排序
        待放行排序.removeAll()
        continuations.forEach { $0.resume() }
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 分类服务测试错误.缺少响应
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
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
    private let 后续目录: CategoriesResponse?
    private var 列表请求计数 = 0
    private var 第二次请求已开始: CheckedContinuation<Void, Never>?
    private var 旧目录响应放行: CheckedContinuation<Void, Never>?

    init(
        初始目录: CategoriesResponse,
        旧目录结果: Result<CategoriesResponse, 分类服务测试错误>,
        新分类: ArticleCategory,
        后续目录: CategoriesResponse? = nil
    ) {
        self.初始目录 = 初始目录
        self.旧目录结果 = 旧目录结果
        self.新分类 = 新分类
        self.后续目录 = 后续目录
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        if 列表请求计数 == 1 {
            return 初始目录
        }

        if 列表请求计数 == 2 {
            第二次请求已开始?.resume()
            第二次请求已开始 = nil
            await withCheckedContinuation { continuation in
                旧目录响应放行 = continuation
            }
            return try 旧目录结果.get()
        }

        guard let 后续目录 else { throw 分类服务测试错误.缺少响应 }
        return 后续目录
    }

    func 等待第二次列表请求开始() async {
        if 列表请求计数 >= 2 { return }
        await withCheckedContinuation { continuation in
            第二次请求已开始 = continuation
        }
    }

    func 放行旧目录响应() {
        旧目录响应放行?.resume()
        旧目录响应放行 = nil
    }

    func 列表请求次数() -> Int {
        列表请求计数
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
