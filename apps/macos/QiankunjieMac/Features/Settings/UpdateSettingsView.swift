import AppKit
import QiankunjieDesignSystem
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

@MainActor protocol UpdateInstalling {
    func install(_ update: DownloadedUpdate) throws
}

extension UpdateInstaller: UpdateInstalling {}

protocol UpdateServicing: Sendable {
    func checkForUpdate() async throws -> AppRelease?
    func download(
        _ release: AppRelease,
        progress: @escaping @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate
    func fetchUpdateLog(for version: String) async throws -> String?
}

extension GitHubUpdateService: UpdateServicing {}

@MainActor
@Observable
final class UpdateSettingsModel {
    nonisolated private static let mirrorStorageKey = "update.mirrorBase"

    private(set) var phase: UpdatePhase = .idle
    private(set) var release: AppRelease?
    /// 检测到新版本后待用户确认的更新；非 nil 时界面弹出更新确认窗。
    private(set) var pendingUpdate: AppRelease?
    private(set) var downloadedUpdate: DownloadedUpdate?
    private(set) var progress: Double?
    private(set) var updateLog: String?
    private(set) var isFetchingUpdateLog = false
    private(set) var updateLogErrorText: String?
    private(set) var mirrorBase: String

    private let service: any UpdateServicing
    private let defaults: UserDefaults
    private let currentVersion: String
    private let updateLogCache: UpdateLogCache
    private let installer: any UpdateInstalling
    private let terminateApplication: @MainActor () -> Void
    private var downloadGeneration = 0

    convenience init(currentVersion: String) {
        self.init(
            currentVersion: currentVersion,
            service: GitHubUpdateService(
                currentVersion: currentVersion,
                mirrorBaseProvider: {
                    let storedMirror = UserDefaults.standard.string(forKey: UpdateSettingsModel.mirrorStorageKey)
                    return storedMirror?.isEmpty == false ? storedMirror : nil
                }
            ),
            defaults: .standard
        )
    }

    init(
        currentVersion: String,
        service: any UpdateServicing,
        defaults: UserDefaults,
        installer: any UpdateInstalling = UpdateInstaller(),
        terminateApplication: @escaping @MainActor () -> Void = {
            NSApplication.shared.terminate(nil)
        }
    ) {
        self.service = service
        self.defaults = defaults
        self.currentVersion = currentVersion
        let updateLogCache = UpdateLogCache(defaults: defaults)
        self.updateLogCache = updateLogCache
        updateLog = updateLogCache.read(currentVersion: currentVersion)
        self.installer = installer
        self.terminateApplication = terminateApplication
        mirrorBase = defaults.string(forKey: Self.mirrorStorageKey) ?? ""
    }

    var canModifyMirror: Bool {
        !isBusy
    }

    var mirrorMode: Binding<UpdateMirrorMode> {
        Binding {
            self.mirrorBase.isEmpty ? .direct : .custom
        } set: { newValue in
            self.selectMirrorMode(newValue)
        }
    }

    func selectMirrorMode(_ mode: UpdateMirrorMode) {
        guard canModifyMirror else { return }

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
        guard canModifyMirror else { return }

        let trimmedMirror = mirrorBase.trimmingCharacters(in: .whitespacesAndNewlines)
        mirrorBase = trimmedMirror
        if trimmedMirror.isEmpty {
            defaults.removeObject(forKey: Self.mirrorStorageKey)
            return
        }

        if Self.isValidMirrorBase(trimmedMirror) {
            defaults.set(trimmedMirror, forKey: Self.mirrorStorageKey)
            phase = .idle
        } else {
            phase = .failed("镜像地址必须是 HTTPS 根地址")
        }
    }

    func updateMirrorDraft(_ value: String) {
        guard canModifyMirror else { return }

        mirrorBase = value
    }

    func checkForUpdate() async {
        guard !isBusy else { return }
        phase = .checking
        do {
            let checkedRelease = try await service.checkForUpdate()
            release = checkedRelease
            if checkedRelease == nil {
                phase = .upToDate
            } else {
                phase = .available
                pendingUpdate = checkedRelease
            }
        } catch {
            phase = .failed(Self.failureMessage(error))
        }
    }

    func fetchUpdateLog() async {
        guard !isFetchingUpdateLog else { return }

        isFetchingUpdateLog = true
        updateLogErrorText = nil
        defer { isFetchingUpdateLog = false }

        do {
            let fetchedLog = try await service.fetchUpdateLog(for: currentVersion)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !Task.isCancelled else { return }
            guard let fetchedLog, !fetchedLog.isEmpty else {
                updateLog = nil
                updateLogCache.clear()
                updateLogErrorText = "未找到当前版本的更新日志"
                return
            }

            updateLog = fetchedLog
            updateLogCache.save(fetchedLog, for: currentVersion)
        } catch {
            updateLogErrorText = "获取更新日志失败，请稍后重试"
        }
    }

    /// 用户在更新确认窗里确认更新：关掉确认窗并自动完成下载与安装。
    func confirmUpdate() async {
        pendingUpdate = nil
        await download()
        guard phase == .downloaded else { return }
        install()
    }

    /// 用户关闭更新确认窗，保留下载入口但不自动安装。
    func dismissUpdatePrompt() {
        pendingUpdate = nil
    }

    func download() async {
        guard let release, !isBusy else { return }

        downloadGeneration += 1
        let generation = downloadGeneration
        phase = .downloading
        progress = nil

        do {
            downloadedUpdate = try await service.download(release) { value in
                Task { @MainActor in
                    guard self.downloadGeneration == generation else { return }
                    self.progress = value
                }
            }
            guard downloadGeneration == generation else { return }
            downloadGeneration += 1
            phase = .downloaded
        } catch {
            guard downloadGeneration == generation else { return }
            downloadGeneration += 1
            downloadedUpdate = nil
            progress = nil
            phase = .failed(Self.failureMessage(error))
        }
    }

    func install() {
        guard let downloadedUpdate else { return }

        do {
            try installer.install(downloadedUpdate)
            if let release {
                UpdateCompletionNotice.record(
                    release: release,
                    previousVersion: currentVersion,
                    defaults: defaults
                )
            }
            updateLogCache.clear()
            updateLog = nil
            updateLogErrorText = nil
            phase = .readyToRelaunch
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.terminateApplication()
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

    var failureText: String? {
        if case let .failed(message) = phase {
            return message
        }
        return nil
    }
}

/// 检测到新版本后的确认窗：展示该版本的更新日志，确认后自动下载安装。
private struct UpdatePromptView: View {
    let release: AppRelease
    let onConfirm: () -> Void
    let onCancel: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("发现新版本 v\(release.version)")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))

            if releaseNotes.isEmpty {
                Text("本次更新没有提供说明。")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            } else {
                ScrollView {
                    Text(releaseNotes)
                        .qiankunjieFont(.bodyMedium)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 280)
            }

            HStack {
                Spacer()
                Button("稍后") {
                    onCancel()
                }
                Button("立即更新") {
                    onConfirm()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 480)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var releaseNotes: String {
        (release.releaseNotes ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct UpdateSettingsView: View {
    @State private var model: UpdateSettingsModel
    let updateCheckRequestID: Int

    init(
        currentVersion: String = QiankunjieMacMetadata.appVersion,
        updateCheckRequestID: Int = 0
    ) {
        self.updateCheckRequestID = updateCheckRequestID
        _model = State(initialValue: UpdateSettingsModel(currentVersion: currentVersion))
    }

    init(
        currentVersion: String,
        service: any UpdateServicing,
        defaults: UserDefaults,
        updateCheckRequestID: Int = 0
    ) {
        self.updateCheckRequestID = updateCheckRequestID
        _model = State(initialValue: UpdateSettingsModel(
            currentVersion: currentVersion,
            service: service,
            defaults: defaults
        ))
    }

    var body: some View {
        SettingsRow(title: "当前版本") {
            Text("v" + QiankunjieMacMetadata.appVersion)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .monospacedDigit()
        }
        .task(id: updateCheckRequestID) {
            guard updateCheckRequestID > 0 else { return }
            await model.checkForUpdate()
        }
        .sheet(isPresented: updatePromptBinding) {
            if let release = model.pendingUpdate {
                UpdatePromptView(
                    release: release,
                    onConfirm: {
                        Task {
                            await model.confirmUpdate()
                        }
                    },
                    onCancel: {
                        model.dismissUpdatePrompt()
                    }
                )
            }
        }

        SettingsRowDivider()

        SettingsRow(title: "更新源", subtitle: "直连 GitHub，或填写 HTTPS 镜像地址加速下载。") {
            Picker("更新源", selection: model.mirrorMode) {
                ForEach(UpdateMirrorMode.allCases) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .disabled(!model.canModifyMirror)
        }

        if model.mirrorMode.wrappedValue == .custom {
            SettingsBlockRow(title: "镜像地址") {
                HStack(spacing: 8) {
                    TextField("HTTPS 镜像根地址", text: Binding(
                        get: { model.mirrorBase },
                        set: { model.updateMirrorDraft($0) }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .disabled(!model.canModifyMirror)

                    Button("保存") {
                        model.saveMirror()
                    }
                    .disabled(!model.canModifyMirror)
                }
            }
        }

        SettingsRowDivider()

        updateLogSection

        SettingsRowDivider()

        updateContent

        SettingsActionsRow {
            Button {
                Task {
                    await model.checkForUpdate()
                }
            } label: {
                Text("检查更新")
            }
            .disabled(model.isBusy)
        }

        if let failureText = model.failureText {
            Text(failureText)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
        }
    }

    @Environment(\.colorScheme) private var colorScheme

    private var updatePromptBinding: Binding<Bool> {
        Binding(
            get: { model.pendingUpdate != nil },
            set: { isPresented in
                if !isPresented {
                    model.dismissUpdatePrompt()
                }
            }
        )
    }

    private var updateLogSection: some View {
        SettingsBlockRow(title: "更新日志", subtitle: "只展示当前版本的更新说明。") {
            VStack(alignment: .leading, spacing: 8) {
                if let updateLog = model.updateLog, !updateLog.isEmpty {
                    Text(updateLog)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if let error = model.updateLogErrorText {
                    Text(error)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(
                            colorScheme == .dark
                                ? QiankunjieColors.darkError
                                : QiankunjieColors.lightError
                        )
                } else {
                    Text("尚未获取更新日志")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }

                SettingsActionsRow {
                    Button("获取更新日志") {
                        Task {
                            await model.fetchUpdateLog()
                        }
                    }
                    .disabled(model.isFetchingUpdateLog)
                }
            }
        }
    }

    @ViewBuilder
    private var updateContent: some View {
        switch model.phase {
        case .checking:
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
                Text("正在检查更新")
                    .qiankunjieFont(.bodyMedium)
            }
        case .upToDate:
            Label("已是最新版本", systemImage: "checkmark.circle.fill")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        case .available:
            if let release = model.release {
                SettingsRow(title: "新版本", subtitle: release.releaseNotes?.isEmpty == false ? "可在「更新日志」中查看说明。" : nil) {
                    Button("下载并安装") {
                        Task {
                            await model.confirmUpdate()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        case .downloading:
            VStack(alignment: .leading, spacing: 8) {
                if let progress = model.progress {
                    ProgressView(value: progress)
                    Text("已下载 \(Int(progress * 100))%")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                } else {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在下载更新")
                            .qiankunjieFont(.bodyMedium)
                    }
                }
            }
        case .downloaded:
            Text("SHA-256 校验通过，正在退出并安装")
                .qiankunjieFont(.bodyMedium)
        case .readyToRelaunch:
            Text("正在退出应用并完成安装")
                .qiankunjieFont(.bodyMedium)
        case .idle, .failed:
            EmptyView()
        }
    }
}
