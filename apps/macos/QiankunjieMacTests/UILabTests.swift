import Testing
@testable import QiankunjieMac

@MainActor
struct UILabTests {
    @Test func uiLabCoversEveryCoreScenario() {
        #expect(UILabScenario.allCases == [
            .login, .library, .empty, .loading, .offline, .reader, .collect, .tasks, .settings, .update
        ])
        #expect(UILabFixtures.article.id == 1001)
        #expect(UILabFixtures.user.id == 9001)
    }

    @Test func uiLabParsesExplicitLaunchScenario() {
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac", "--ui-lab", "reader"]) == .reader)
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac"]) == nil)
        #expect(UILabScenario.commandLineScenario(arguments: ["/tmp/QiankunjieMac", "--ui-lab", "demo"]) == nil)
    }
}
