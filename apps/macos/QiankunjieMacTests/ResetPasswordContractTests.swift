import Testing
@testable import QiankunjieMac

@MainActor
struct ResetPasswordContractTests {
    @Test func resetPasswordTargetsTheTopLevelAPIRoute() {
        #expect(ManagementAPIRoute.changePassword == "change-password")
    }

    @Test func passwordVisibilityUsesClosedEyeUntilRevealed() {
        #expect(ResetPasswordView.passwordVisibilitySymbol(isVisible: false) == "eye.slash")
        #expect(ResetPasswordView.passwordVisibilitySymbol(isVisible: true) == "eye")
    }
}
