import Foundation
import QiankunjieUpdating
import Testing
@testable import QiankunjieMac

actor GatedUpdateService: UpdateServicing {
    private let release = AppRelease.fixture()
    private var continuation: CheckedContinuation<Void, Never>?
    private var progressHandler: ((Double?) -> Void)?

    private(set) var downloadCount = 0

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

    func emitLateProgress(_ value: Double) {
        progressHandler?(value)
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
    @Test func downloadIgnoresConcurrentCallAndLocksMirrorControls() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        defaults.set("https://ghfast.top", forKey: "update.mirrorBase")
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(currentVersion: "1.2.0", service: service, defaults: defaults)
        let deadline = waitForDeadline()

        let checkTask = Task {
            await model.checkForUpdate()
        }
        while model.release == nil {
            if Task.isCancelled {
                Issue.record("模型未获取更新信息")
                return
            }
            if Date() > deadline {
                Issue.record("等待更新信息超时")
                return
            }
            try await Task.sleep(for: .milliseconds(1))
        }
        #expect(model.release != nil)

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
        await checkTask.value

        #expect(model.phase == .downloaded)
        #expect(model.canModifyMirror)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func lateDownloadProgressDoesNotOverwriteCompletedOperation() async throws {
        let (defaults, suiteName) = try temporaryDefaults()
        let service = GatedUpdateService()
        let model = UpdateSettingsModel(currentVersion: "1.2.0", service: service, defaults: defaults)
        let deadline = waitForDeadline()

        let checkTask = Task {
            await model.checkForUpdate()
        }
        while model.release == nil {
            if Task.isCancelled {
                Issue.record("迟到回调测试模型未获取更新信息")
                return
            }
            if Date() > deadline {
                Issue.record("迟到回调测试等待更新信息超时")
                return
            }
            try await Task.sleep(for: .milliseconds(1))
        }
        #expect(model.release != nil)

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
        await checkTask.value

        await service.emitLateProgress(0.9)
        try await Task.sleep(for: .milliseconds(50))

        #expect(model.phase == .downloaded)
        #expect(model.progress == 0.25)
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
