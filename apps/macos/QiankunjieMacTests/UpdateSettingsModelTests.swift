import Foundation
import QiankunjieUpdating
import Testing
@testable import QiankunjieMac

actor GatedUpdateService: UpdateServicing {
    private let release = AppRelease.fixture()
    private var continuation: CheckedContinuation<Void, Never>?
    private var progressHandler: ((Double?) -> Void)?

    private(set) var downloadCount = 0
    private(set) var updateLogFetchCount = 0
    var updateLog: String? = "测试更新日志"

    func checkForUpdate() async throws -> AppRelease? {
        release
    }

    func download(
        _ release: AppRelease,
        progress: @escaping @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate {
        downloadCount += 1
        progressHandler = progress
        progress(0.25)
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
        return DownloadedUpdate(
            version: release.version,
            fileURL: FileManager.default.temporaryDirectory.appendingPathComponent("gated-update.dmg"),
            sha256: String(repeating: "a", count: 64)
        )
    }

    func resumeDownload() {
        continuation?.resume()
        continuation = nil
    }

    func fetchUpdateLog(for version: String) async throws -> String? {
        updateLogFetchCount += 1
        return updateLog
    }

    func emitLateProgress(_ value: Double) {
        progressHandler?(value)
    }

}

actor ImmediateUpdateService: UpdateServicing {
    private let release = AppRelease.fixture()

    func checkForUpdate() async throws -> AppRelease? {
        release
    }

    func download(
        _ release: AppRelease,
        progress: @escaping @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate {
        progress(1)
        return DownloadedUpdate(
            version: release.version,
            fileURL: FileManager.default.temporaryDirectory.appendingPathComponent("immediate-update.dmg"),
            sha256: String(repeating: "b", count: 64)
        )
    }

    func fetchUpdateLog(for version: String) async throws -> String? {
        "测试更新日志"
    }
}

@MainActor
final class UpdateInstallerSpy: UpdateInstalling {
    private(set) var installCount = 0

    func install(_ update: DownloadedUpdate) throws {
        installCount += 1
    }
}

extension AppRelease {
    fileprivate static func fixture() -> AppRelease {
        let downloadURL = URL(
            string: "https://github.com/dick86114/storing/releases/download/macos-v1.3.0/Qiankunjie-1.3.0-arm64.dmg"
        )!
        return AppRelease(
            version: "1.3.0",
            tagName: "macos-v1.3.0",
            releaseNotes: "测试更新",
            publishedAt: nil,
            assetName: "Qiankunjie-1.3.0-arm64.dmg",
            downloadURL: downloadURL,
            checksumURL: downloadURL.appendingPathExtension("sha256"),
            sha256: String(repeating: "a", count: 64)
        )
    }
}

@MainActor
struct UpdateSettingsModelTests {
    @Test func 检测更新后停在可下载状态且不自动下载() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(currentVersion: "1.2.0", service: service, defaults: defaults)

        await model.checkForUpdate()

        #expect(model.phase == .available)
        #expect(model.release != nil)
        #expect(await service.downloadCount == 0)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 确认更新会自动下载并安装() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let installer = UpdateInstallerSpy()
        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: ImmediateUpdateService(),
            defaults: defaults,
            installer: installer,
            terminateApplication: {}
        )

        await model.checkForUpdate()
        #expect(model.pendingUpdate?.version == "1.3.0")

        await model.confirmUpdate()

        #expect(model.pendingUpdate == nil)
        #expect(installer.installCount == 1)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 关闭更新确认窗不会安装() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let installer = UpdateInstallerSpy()
        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: ImmediateUpdateService(),
            defaults: defaults,
            installer: installer,
            terminateApplication: {}
        )

        await model.checkForUpdate()
        model.dismissUpdatePrompt()

        #expect(model.pendingUpdate == nil)
        #expect(model.phase == .available)
        #expect(installer.installCount == 0)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func downloadIgnoresConcurrentCallAndLocksMirrorControls() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        defaults.set("https://ghfast.top", forKey: "update.mirrorBase")
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(currentVersion: "1.2.0", service: service, defaults: defaults)
        let deadline = waitForDeadline()

        await model.checkForUpdate()
        #expect(model.phase == .available)

        let downloadTask = Task {
            await model.download()
        }

        while model.phase != .downloading {
            if Task.isCancelled {
                Issue.record("模型未进入下载状态")
                return
            }
            if Date() > deadline {
                Issue.record("等待模型下载状态超时")
                return
            }
            try await Task.sleep(for: .milliseconds(1))
        }
        while await service.downloadCount == 0 {
            if Task.isCancelled {
                Issue.record("服务未开始下载")
                return
            }
            if Date() > deadline {
                Issue.record("等待服务下载计数超时")
                return
            }
            try await Task.sleep(for: .milliseconds(1))
        }

        #expect(model.phase == .downloading)
        #expect(model.progress == 0.25)
        #expect(!model.canModifyMirror)

        await model.download()
        model.selectMirrorMode(.direct)
        model.updateMirrorDraft("https://mirror.example")
        model.saveMirror()

        #expect(await service.downloadCount == 1)
        #expect(model.mirrorBase == "https://ghfast.top")
        #expect(model.phase == .downloading)

        await service.resumeDownload()
        await downloadTask.value

        #expect(model.phase == .downloaded)
        #expect(model.canModifyMirror)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func lateDownloadProgressDoesNotOverwriteCompletedOperation() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(currentVersion: "1.2.0", service: service, defaults: defaults)
        let deadline = waitForDeadline()

        await model.checkForUpdate()
        #expect(model.phase == .available)

        let downloadTask = Task {
            await model.download()
        }

        while model.phase != .downloading {
            if Task.isCancelled {
                Issue.record("迟到回调测试模型未进入下载状态")
                return
            }
            if Date() > deadline {
                Issue.record("迟到回调测试等待模型下载状态超时")
                return
            }
            try await Task.sleep(for: .milliseconds(1))
        }
        await service.resumeDownload()
        await downloadTask.value

        await service.emitLateProgress(0.9)
        try await Task.sleep(for: .milliseconds(50))

        #expect(model.phase == .downloaded)
        #expect(model.progress == 0.25)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 更新日志默认只读当前版本缓存() throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let cache = UpdateLogCache(defaults: defaults)
        cache.save("1.2.0 更新日志", for: "1.2.0")

        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: GatedUpdateService(),
            defaults: defaults
        )

        #expect(model.updateLog == "1.2.0 更新日志")
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 获取更新日志只在点击后刷新并按版本复用缓存() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: service,
            defaults: defaults
        )

        #expect(model.updateLog == nil)
        #expect(await service.updateLogFetchCount == 0)

        await model.fetchUpdateLog()

        #expect(model.updateLog == "测试更新日志")
        #expect(await service.updateLogFetchCount == 1)

        let cachedModel = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: service,
            defaults: defaults
        )

        #expect(cachedModel.updateLog == "测试更新日志")
        #expect(await service.updateLogFetchCount == 1)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 当前版本不匹配时更新日志缓存失效() throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let cache = UpdateLogCache(defaults: defaults)
        cache.save("1.1.0 更新日志", for: "1.1.0")

        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: GatedUpdateService(),
            defaults: defaults
        )

        #expect(model.updateLog == nil)
        #expect(cache.read(currentVersion: "1.1.0") == nil)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func 安装完成后清空当前版本更新日志缓存() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let cache = UpdateLogCache(defaults: defaults)
        cache.save("1.2.0 更新日志", for: "1.2.0")
        let installer = UpdateInstallerSpy()
        let model = UpdateSettingsModel(
            currentVersion: "1.2.0",
            service: ImmediateUpdateService(),
            defaults: defaults,
            installer: installer,
            terminateApplication: {}
        )

        await model.checkForUpdate()
        #expect(model.phase == .available)

        await model.download()
        #expect(model.phase == .downloaded)

        model.install()

        #expect(installer.installCount == 1)
        #expect(model.updateLog == nil)
        #expect(cache.read(currentVersion: "1.2.0") == nil)
        defaults.removePersistentDomain(forName: suiteName)
    }

    private func temporaryDefaults() throws -> (UserDefaults, String) {
        let suiteName = "task-13-update-model-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        return (defaults, suiteName)
    }

    private func waitForDeadline() -> Date {
        Date().addingTimeInterval(2)
    }
}
