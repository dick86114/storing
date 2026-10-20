import SwiftUI
import Testing
@testable import QiankunjieMac

@MainActor
struct UILabTests {
    @Test func uiLabCoversEveryCoreScenario() {
        #expect(UILabScenario.allCases == [
            .login, .library, .empty, .loading, .offline, .reader, .collect, .tasks, .settings, .update, .updateNotice
        ])
        #expect(UILabFixtures.article.id == 1001)
        #expect(UILabFixtures.user.id == 9001)
        #expect(UILabFixtures.updateCompletionNotice.version == "0.2.0")
        #expect(UILabFixtures.updateCompletionNotice.previousVersion == "0.1.0")
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
