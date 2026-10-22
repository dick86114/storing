import Foundation
import QiankunjieUpdating

/// 更新安装完成后跨进程传递的版本详情。日志和发布页一并保存，
/// 新版本首次启动时无需再请求网络。
struct UpdateCompletionNotice: Codable, Equatable, Sendable {
    static let storageKey = "update.completion.notice.v1"
    static let releasesPageURL = URL(string: "https://github.com/dick86114/storing/releases")!

    let version: String
    let previousVersion: String?
    let notes: String
    let releaseURL: URL
    let publishedAt: Date?

    init(
        version: String,
        previousVersion: String?,
        notes: String,
        releaseURL: URL,
        publishedAt: Date? = nil
    ) {
        self.version = version
        self.previousVersion = previousVersion
        self.notes = notes
        self.releaseURL = releaseURL
        self.publishedAt = publishedAt
    }

    init(release: AppRelease, previousVersion: String, notes: String? = nil) {
        let normalizedPrevious = previousVersion.trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(
            version: release.version,
            previousVersion: normalizedPrevious.isEmpty ? nil : normalizedPrevious,
            notes: UpdateReleaseNotesText.normalized(notes ?? release.releaseNotes, version: release.version) ?? "",
            releaseURL: Self.releaseURL(forTag: release.tagName, version: release.version),
            publishedAt: release.publishedAt
        )
    }

    static func currentVersion(version: String, notes: String) -> UpdateCompletionNotice {
        UpdateCompletionNotice(
            version: version,
            previousVersion: nil,
            notes: UpdateReleaseNotesText.normalized(notes, version: version) ?? "",
            releaseURL: releaseURL(forTag: "macos-v\(version)", version: version)
        )
    }

    func replacingNotes(_ notes: String?) -> UpdateCompletionNotice {
        UpdateCompletionNotice(
            version: version,
            previousVersion: previousVersion,
            notes: UpdateReleaseNotesText.normalized(notes, version: version) ?? "",
            releaseURL: releaseURL,
            publishedAt: publishedAt
        )
    }

    static func record(
        release: AppRelease,
        previousVersion: String,
        notes: String? = nil,
        defaults: UserDefaults = .standard
    ) {
        let notice = UpdateCompletionNotice(
            release: release,
            previousVersion: previousVersion,
            notes: notes
        )
        guard let data = try? JSONEncoder().encode(notice) else { return }
        defaults.set(data, forKey: storageKey)
    }

    static func consume(defaults: UserDefaults = .standard) -> UpdateCompletionNotice? {
        defer { defaults.removeObject(forKey: storageKey) }
        guard
            let data = defaults.data(forKey: storageKey),
            let notice = try? JSONDecoder().decode(UpdateCompletionNotice.self, from: data)
        else {
            return nil
        }
        return notice
    }

    static func releaseURL(forTag tagName: String, version: String) -> URL {
        URL(string: "https://github.com/dick86114/storing/releases/tag/\(tagName)")
            ?? URL(string: "https://github.com/dick86114/storing/releases/tag/macos-v\(version)")
            ?? releasesPageURL
    }
}
