import SwiftUI
import Testing
@testable import QiankunjieMac

@MainActor
struct UILabTests {
    @Test func 界面实验室覆盖全部核心场景() {
        #expect(UILabScenario.allCases.map(\.rawValue) == [
            "login", "library", "empty", "loading", "offline", "reader", "collect", "tasks", "settings", "ai-settings", "update",
            "update-notice", "current-version", "category-picker", "category-management",
            "reader-category-unavailable", "category-create-cancel",
        ])
        #expect(UILabFixtures.article.id == 1001)
        #expect(UILabFixtures.user.id == 9001)
        #expect(UILabFixtures.updateCompletionNotice.version == "0.2.0")
        #expect(UILabFixtures.updateCompletionNotice.previousVersion == "0.1.0")
    }

    @Test func 界面实验室覆盖分类导航选择器和管理页() {
        let scenarioValues = Set(UILabScenario.allCases.map(\.rawValue))

        #expect(scenarioValues.contains("library"))
        #expect(scenarioValues.contains("category-picker"))
        #expect(scenarioValues.contains("category-management"))
    }

    @Test func 界面实验室覆盖分类失效与创建取消定向场景() {
        let scenarioValues = Set(UILabScenario.allCases.map(\.rawValue))

        #expect(scenarioValues.contains("reader-category-unavailable"))
        #expect(scenarioValues.contains("category-create-cancel"))
    }

    @Test func 界面实验室分类夹具包含启用停用系统最近使用和全部分类() {
        let categories = UILabFixtures.readerCategories
        let activeUserCategoryNames = Set(
            categories
                .filter { $0.isActive && !$0.isSystem }
                .map(\.name)
        )
        let recentCategoryNames = UILabFixtures.categoryCatalog.recentCategoryIDs.compactMap { categoryID in
            categories.first { $0.id == categoryID }?.name
        }

        #expect(activeUserCategoryNames.isSuperset(of: ["工作", "技术"]))
        #expect(categories.contains { !$0.isActive && !$0.isSystem })
        #expect(categories.contains { $0.isSystem && $0.name == "待整理" })
        #expect(categories.count >= 6)
        #expect(recentCategoryNames == ["工作", "技术"])
        #expect(UILabFixtures.appModel.isAuthenticated)
        #expect(UILabFixtures.appModel.categoryCatalog === UILabFixtures.categoryCatalog)
    }

    @Test func 界面实验室分类排序响应同步更新可观察顺序() async throws {
        let service = FixtureCategoryCatalogService(categories: UILabFixtures.categoryFixtures)

        let response = try await service.reorder(categoryIDs: [1, 3, 2, 4, 5, 6])

        #expect(response.categories.map(\.id) == [1, 3, 2, 4, 5, 6])
        #expect(response.categories.map(\.sortOrder) == [0, 10, 20, 30, 40, 50])
    }

    @Test func uiLabTaskFixturesCoverEveryActionState() {
        let statuses = UILabFixtures.collectJobs.map(\.status)

        #expect(statuses == ["pending", "running", "completed", "failed"])
        #expect(UILabFixtures.collectJobs.map(\.id) == [7000, 7001, 7002, 7003])
    }

    @Test func uiLabTaskRowsExposeOnlyAllowedActions() {
        let queued = UILabScenario.taskActionAvailability(for: UILabFixtures.collectJobs[0])
        let running = UILabScenario.taskActionAvailability(for: UILabFixtures.collectJobs[1])
        let completed = UILabScenario.taskActionAvailability(for: UILabFixtures.collectJobs[2])
        let failed = UILabScenario.taskActionAvailability(for: UILabFixtures.collectJobs[3])

        #expect(queued == UILabTaskActionAvailability(canOpenArticle: false, canRetry: false, canDelete: false))
        #expect(running == UILabTaskActionAvailability(canOpenArticle: false, canRetry: false, canDelete: false))
        #expect(completed == UILabTaskActionAvailability(canOpenArticle: true, canRetry: false, canDelete: true))
        #expect(failed == UILabTaskActionAvailability(canOpenArticle: false, canRetry: true, canDelete: true))
    }

    @Test func uiLabParsesExplicitLaunchScenario() {
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac", "--ui-lab", "reader"]) == .reader)
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac"]) == nil)
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac", "--ui-lab", "demo"]) == nil)
    }

    @Test func uiLabSettingsUseInjectedIsolatedPreferencesAndFixtureUpdateService() {
        #expect(UILabFixtures.preferences != .standard)
        #expect(UILabFixtures.preferenceSuiteName.hasPrefix("com.idickies.storing.macos.uilab."))
        #expect(UILabFixtures.updateService is UILabFixtureUpdateService)
    }

    @Test @MainActor func uiLabAISettingsProvideModelsChartsAndPagedJobs() async {
        let model = UILabFixtures.aiSettingsModel
        #expect(model.models.count == 8)
        #expect(model.jobs.count == 10)
        #expect(model.usage?.totalJobs == 27)
        #expect(model.totalPages == 3)

        await model.nextPage()
        #expect(model.currentPage == 2)
        #expect(model.jobs.count == 10)

        await model.nextPage()
        #expect(model.currentPage == 3)
        #expect(model.jobs.count == 7)

        await model.previousPage()
        #expect(model.currentPage == 2)
        #expect(model.jobs.count == 10)
    }

    @Test func uiLabCanForceLightAndDarkAppearanceFromCommandLine() {
        #expect(UILabAppearance.commandLineColorScheme(
            arguments: ["/tmp/storing", "--ui-lab", "update-notice", "--ui-lab-appearance", "light"]
        ) == .light)
        #expect(UILabAppearance.commandLineColorScheme(
            arguments: ["/tmp/storing", "--ui-lab", "update-notice", "--ui-lab-appearance", "dark"]
        ) == .dark)
        #expect(UILabAppearance.commandLineColorScheme(arguments: ["/tmp/storing"]) == nil)
    }
}
