import Foundation
import QiankunjieUpdating
import Testing
@testable import QiankunjieMac

actor UpdateNoticeLogLoader {
    private var responses: [String?]
    private(set) var callCount = 0

    init(responses: [String?]) {
        self.responses = responses
    }

    func load() -> String? {
        callCount += 1
        return responses.removeFirst()
    }
}

struct UpdateCompletionNoticeTests {
    @Test func 更新完成通知跨启动保存且只消费一次() {
        let suiteName = "storing.update-completion-notice.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let release = AppRelease(
            version: "0.4.0",
            tagName: "macos-v0.4.0",
            releaseNotes: "新增更新完成提示\n修复若干问题",
            publishedAt: Date(timeIntervalSince1970: 1_763_000_000),
            assetName: "Qiankunjie-0.4.0-arm64.dmg",
            downloadURL: URL(string: "https://example.com/Qiankunjie-0.4.0.dmg")!,
            checksumURL: nil,
            sha256: nil
        )

        UpdateCompletionNotice.record(
            release: release,
            previousVersion: "0.3.7",
            defaults: defaults
        )

        let notice = UpdateCompletionNotice.consume(defaults: defaults)
        #expect(notice?.version == "0.4.0")
        #expect(notice?.previousVersion == "0.3.7")
        #expect(notice?.notes == "新增更新完成提示\n修复若干问题")
        #expect(notice?.releaseURL.absoluteString == "https://github.com/dick86114/storing/releases/tag/macos-v0.4.0")
        #expect(notice?.publishedAt == release.publishedAt)
        #expect(UpdateCompletionNotice.consume(defaults: defaults) == nil)
    }

    @Test func 当前版本详情复用同一通知模型() {
        let notice = UpdateCompletionNotice.currentVersion(
            version: "0.4.0",
            notes: "当前版本更新日志"
        )

        #expect(notice.version == "0.4.0")
        #expect(notice.previousVersion == nil)
        #expect(notice.notes == "当前版本更新日志")
        #expect(notice.releaseURL.absoluteString == "https://github.com/dick86114/storing/releases/tag/macos-v0.4.0")
    }

    @Test func 只有版本标题时不能冒充更新日志() {
        let suiteName = "storing.update-title-only.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let release = AppRelease(
            version: "0.4.0",
            tagName: "macos-v0.4.0",
            releaseNotes: "乾坤戒 macOS v0.4.0",
            publishedAt: nil,
            assetName: "Qiankunjie-0.4.0-arm64.dmg",
            downloadURL: URL(string: "https://example.com/Qiankunjie-0.4.0.dmg")!,
            checksumURL: nil,
            sha256: nil
        )

        UpdateCompletionNotice.record(release: release, previousVersion: "0.3.9", defaults: defaults)

        #expect(UpdateCompletionNotice.consume(defaults: defaults)?.notes == "")
    }

    @Test func 更新日志保留标题与列表层级() {
        let lines = UpdateReleaseNotesFormatter.lines(from: """
        ## 新增
        - 支持点击首页版本号回看更新内容
        - 更新完成后自动展示版本详情

        ## 修复
        - 修复长日志排版
        """)

        #expect(lines.map(\.kind) == [.heading, .bullet, .bullet, .heading, .bullet])
        #expect(lines.map(\.text) == [
            "新增",
            "支持点击首页版本号回看更新内容",
            "更新完成后自动展示版本详情",
            "修复",
            "修复长日志排版",
        ])
    }

    @Test func 当前版本有缓存时刷新按钮才强制请求远端() async {
        let loader = UpdateNoticeLogLoader(responses: ["刷新后的日志"])
        let state = await UpdateCompletionNoticeNotesState(
            initialNotes: "缓存日志",
            loadNotes: { await loader.load() }
        )

        await state.loadIfNeeded()
        #expect(await loader.callCount == 0)
        #expect(await state.displayedNotes == "缓存日志")

        await state.refresh()

        #expect(await loader.callCount == 1)
        #expect(await state.displayedNotes == "刷新后的日志")
        #expect(await state.isRefreshingNotes == false)
        #expect(await state.refreshError == nil)
    }

    @Test func 刷新失败时保留旧日志并显示错误() async {
        let loader = UpdateNoticeLogLoader(responses: [nil])
        let state = await UpdateCompletionNoticeNotesState(
            initialNotes: "已有缓存日志",
            loadNotes: { await loader.load() }
        )

        await state.refresh()

        #expect(await loader.callCount == 1)
        #expect(await state.displayedNotes == "已有缓存日志")
        #expect(await state.refreshError == "刷新更新日志失败，请稍后重试")
    }

    @Test func 更新完成窗口和首页版本入口契约() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let appModel = try String(
            contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/App/AppModel.swift"),
            encoding: .utf8
        )
        let rootWindow = try String(
            contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/App/RootWindow.swift"),
            encoding: .utf8
        )
        let titleLabel = try String(
            contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/App/MainWindowTitleLabel.swift"),
            encoding: .utf8
        )
        let noticeView = try String(
            contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Updating/UpdateCompletionNoticeView.swift"),
            encoding: .utf8
        )
        let updateSettingsView = try String(
            contentsOf: repositoryRoot.appendingPathComponent("QiankunjieMac/Features/Settings/UpdateSettingsView.swift"),
            encoding: .utf8
        )

        #expect(appModel.contains("presentPendingUpdateCompletionNoticeIfNeeded"))
        #expect(appModel.contains("presentCurrentVersionDetails"))
        #expect(rootWindow.contains("MainWindowTitleLabel(onOpenVersionDetails:"))
        #expect(titleLabel.contains("Button(action: onOpenVersionDetails)"))
        #expect(titleLabel.contains("查看当前版本更新内容"))
        #expect(noticeView.contains("UpdateCompletionDragHandle"))
        #expect(noticeView.contains("window.level = .floating"))
        #expect(noticeView.contains(".canJoinAllSpaces"))
        #expect(noticeView.contains("GlassSurface"))
        #expect(noticeView.contains("QiankunjieColors"))
        #expect(noticeView.contains("@Environment(\\.colorScheme)"))
        #expect(noticeView.contains("UpdateLogCache().save(normalized, for: version)"))
        #expect(noticeView.contains("notice.replacingNotes(resolvedNotes)"))
        #expect(noticeView.contains("arrow.clockwise"))
        #expect(noticeView.contains("重新获取更新日志"))
        #expect(noticeView.contains("let loadNotes: @Sendable () async -> String?"))
        #expect(updateSettingsView.contains("isFetchingPendingUpdateLog"))
        #expect(updateSettingsView.contains("正在读取新版本更新日志"))
    }
}
