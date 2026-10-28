import Foundation
import Testing
@testable import QiankunjieUpdating

@Test func githubTokenStoreSavesMasksAndClearsToken() async throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("qiankunjie-github-token-\(UUID().uuidString)", isDirectory: true)
    let fileURL = directory.appendingPathComponent("token.json")
    let store = GitHubTokenStore(fileURL: fileURL)

    try await store.saveGitHubToken("  ghp_1234567890abcdef  ")

    #expect(await store.readGitHubToken() == "ghp_1234567890abcdef")
    #expect(GitHubTokenRules.masked("ghp_1234567890abcdef") == "ghp_…cdef")
    let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
    #expect((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o600)

    try await store.clearGitHubToken()

    #expect(await store.readGitHubToken() == nil)
    try? FileManager.default.removeItem(at: directory)
}

@Test func githubTokenRulesRejectEmptyAndWhitespaceTokens() {
    #expect(GitHubTokenRules.normalized(nil) == nil)
    #expect(GitHubTokenRules.normalized("   ") == nil)
    #expect(GitHubTokenRules.normalized("ghp_123 456") == nil)
    #expect(GitHubTokenRules.normalized(" github_pat_123 ") == "github_pat_123")
}
