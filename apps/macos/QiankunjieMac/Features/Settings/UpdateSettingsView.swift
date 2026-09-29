import AppKit
import QiankunjieUpdating
import SwiftUI

enum UpdatePhase: Equatable {
    case idle
    case checking
    case upToDate
    case available
    case downloading
    case downloaded
    case readyToRelaunch
    case failed(String)
}

enum UpdateMirrorMode: String, CaseIterable, Identifiable {
    case direct
    case custom

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .direct: "直连"
        case .custom: "镜像"
        }
    }
}

@MainActor
@Observable
final class UpdateSettingsModel {
    nonisolated(unsafe) private static let mirrorStorageKey = "update.mirrorBase"

    private(set) var phase: UpdatePhase = .idle
    private(set) var release: AppRelease?
    private(set) var downloadedUpdate: DownloadedUpdate?
    private(set) var progress: Double?
    private(set) var mirrorBase = UserDefaults.standard.string(forKey: UpdateSettingsModel.mirrorStorageKey) ?? ""

    private let service: GitHubUpdateService
    private let installer = UpdateInstaller()

    init(currentVersion: String) {
        service = GitHubUpdateService(
            currentVersion: currentVersion,
            mirrorBaseProvider: {
                let storedMirror = UserDefaults.standard.string(forKey: UpdateSettingsModel.mirrorStorageKey)
                return storedMirror?.isEmpty == false ? storedMirror : nil
            }
        )
    }

    var mirrorMode: Binding<UpdateMirrorMode> {
        Binding {
            self.mirrorBase.isEmpty ? .direct : .custom
        } set: { newValue in
            self.applyMirrorMode(newValue)
        }
    }

    private func applyMirrorMode(_ mode: UpdateMirrorMode) {
        switch mode {
        case .direct:
            mirrorBase = ""
            saveMirror()
        case .custom:
            if mirrorBase.isEmpty {
                mirrorBase = "https://ghfast.top"
                saveMirror()
            }
        }
    }

    func saveMirror() {
        let trimmedMirror = mirrorBase.trimmingCharacters(in: .whitespacesAndNewlines)
        mirrorBase = trimmedMirror
        if trimmedMirror.isEmpty {
            UserDefaults.standard.removeObject(forKey: Self.mirrorStorageKey)
            return
        }

        if Self.isValidMirrorBase(trimmedMirror) {
            UserDefaults.standard.set(trimmedMirror, forKey: Self.mirrorStorageKey)
            phase = .idle
        } else {
            phase = .failed("镜像地址必须是 HTTPS 根地址")
        }
    }

    func updateMirrorDraft(_ value: String) {
        mirrorBase = value
    }

    func checkForUpdate() async {
        guard !isBusy else { return }
        phase = .checking
        do {
            let checkedRelease = try await service.checkForUpdate()
            release = checkedRelease
            phase = checkedRelease == nil ? .upToDate : .available
        } catch {
            phase = .failed(Self.failureMessage(error))
        }
    }

    func download() async {
        guard let release, !isBusy else { return }
        phase = .downloading
        progress = nil
        do {
            downloadedUpdate = try await service.download(release) { value in
                Task { @MainActor in
                    progress = value
                }
            }
            phase = .downloaded
        } catch {
            downloadedUpdate = nil
            progress = nil
            phase = .failed(Self.failureMessage(error))
        }
    }

    func install() {
        guard let downloadedUpdate else { return }
        do {
            try installer.install(downloadedUpdate)
            phase = .readyToRelaunch
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                NSApplication.shared.terminate(nil)
            }
        } catch {
            phase = .failed(Self.failureMessage(error))
        }
    }

    var isBusy: Bool {
        phase == .checking || phase == .downloading
    }

    private static func isValidMirrorBase(_ value: String) -> Bool {
        guard
            let components = URLComponents(string: value),
            components.scheme == "https",
            components.host?.isEmpty == false,
            components.path.isEmpty || components.path == "/"
        else {
            return false
        }
        return true
    }

    private static func failureMessage(_ error: Error) -> String {
        switch error {
        case UpdateServiceError.updateUnavailable:
            "没有可用的新版本"
        case UpdateServiceError.checksumMismatch:
            "更新包校验失败，已拒绝安装"
        case UpdateServiceError.incompleteDownload:
            "更新包下载不完整，可重试续传"
        case UpdateServiceError.checksumUnavailable:
            "缺少 SHA-256 校验值，已拒绝下载"
        case UpdateServiceError.installFailed:
            "安装失败，旧版本备份已尝试恢复"
        case is CancellationError:
            "操作已取消"
        default:
            "更新服务暂不可用，请稍后重试"
        }
    }
}

struct UpdateSettingsView: View {
    @State private var model: UpdateSettingsModel

    init(currentVersion: String = QiankunjieMacMetadata.appVersion) {
        _model = State(initialValue: UpdateSettingsModel(currentVersion: currentVersion))
    }

    var body: some View {
        LabeledContent("当前版本", value: QiankunjieMacMetadata.appVersion)

        Picker("更新源", selection: model.mirrorMode) {
            ForEach(UpdateMirrorMode.allCases) { mode in
                Text(mode.displayName).tag(mode)
            }
        }
        .pickerStyle(.segmented)

        if model.mirrorMode.wrappedValue == .custom {
            TextField("HTTPS 镜像根地址", text: Binding(
                get: { model.mirrorBase },
                set: { model.updateMirrorDraft($0) }
            ))
            .textFieldStyle(.roundedBorder)

            Button("保存镜像") {
                model.saveMirror()
            }
        }

        updateContent

        Button {
            Task {
                await model.checkForUpdate()
            }
        } label: {
            Label("检查更新", systemImage: "arrow.triangle.2.circlepath")
        }
        .disabled(model.isBusy)

        if let failureText = model.failureText {
            Text(failureText)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var updateContent: some View {
        switch model.phase {
        case .checking:
            HStack {
                ProgressView()
                    .controlSize(.small)
                Text("正在检查更新")
            }
        case .upToDate:
            Text("已是最新版本")
        case .available:
            if let release = model.release {
                VStack(alignment: .leading, spacing: 8) {
                    LabeledContent("新版本", value: release.version)
                    if let notes = release.releaseNotes, !notes.isEmpty {
                        Text(notes)
                            .font(.footnote)
                            .lineLimit(6)
                    }
                    Button("下载更新") {
                        Task {
                            await model.download()
                        }
                    }
                }
            }
        case .downloading:
            VStack(alignment: .leading, spacing: 8) {
                if let progress = model.progress {
                    ProgressView(value: progress)
                    Text("已下载 \(Int(progress * 100))%")
                        .font(.footnote)
                } else {
                    ProgressView()
                        .controlSize(.small)
                    Text("正在下载更新")
                        .font(.footnote)
                }
            }
        case .downloaded:
            VStack(alignment: .leading, spacing: 8) {
                Text("SHA-256 校验通过")
                Button("退出并安装") {
                    model.install()
                }
            }
        case .readyToRelaunch:
            Text("正在退出应用并完成安装")
        case .idle, .failed:
            EmptyView()
        }
    }
}

private extension UpdateSettingsModel {
    var failureText: String? {
        if case let .failed(message) = phase {
            return message
        }
        return nil
    }
}
