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
    private(set) var isFetchingPendingUpdateLog = false
    private(set) var pendingUpdateLogErrorText: String?
    private(set) var downloadedUpdate: DownloadedUpdate?
    private(set) var progress: Double?
    private(set) var updateLog: String?
    private(set) var isFetchingUpdateLog = false
    private(set) var updateLogErrorText: String?
    private(set) var mirrorBase: String
    private(set) var gitHubTokenDraft = ""
    private(set) var maskedGitHubToken: String?
    private(set) var gitHubTokenFeedbackText: String?
    private(set) var gitHubTokenFeedbackIsError = false
    private(set) var isSavingGitHubToken = false

    private let service: any UpdateServicing
    private let defaults: UserDefaults
    private let tokenStore: any GitHubTokenStoring
    private let currentVersion: String
    private let updateLogCache: UpdateLogCache
    private let installer: any UpdateInstalling
    private let terminateApplication: @MainActor () -> Void
    private var downloadGeneration = 0
    private var pendingLogRequestGeneration = 0

    convenience init(currentVersion: String) {
        let tokenStore = GitHubTokenStore()
        self.init(
            currentVersion: currentVersion,
            service: GitHubUpdateService(
                currentVersion: currentVersion,
                mirrorBaseProvider: {
                    let storedMirror = UserDefaults.standard.string(forKey: UpdateSettingsModel.mirrorStorageKey)
                    return storedMirror?.isEmpty == false ? storedMirror : nil
                },
                gitHubTokenProvider: {
                    await tokenStore.readGitHubToken()
                }
            ),
            defaults: .standard,
            tokenStore: tokenStore
        )
    }

    init(
        currentVersion: String,
        service: any UpdateServicing,
        defaults: UserDefaults,
        tokenStore: any GitHubTokenStoring = GitHubTokenStore(),
        installer: any UpdateInstalling = UpdateInstaller(),
        terminateApplication: @escaping @MainActor () -> Void = {
            NSApplication.shared.terminate(nil)
        }
    ) {
        self.service = service
        self.defaults = defaults
        self.tokenStore = tokenStore
        self.currentVersion = currentVersion
        let updateLogCache = UpdateLogCache(defaults: defaults)
        self.updateLogCache = updateLogCache
        updateLog = UpdateReleaseNotesText.normalized(
            updateLogCache.read(currentVersion: currentVersion),
            version: currentVersion
        )
        self.installer = installer
        self.terminateApplication = terminateApplication
        mirrorBase = defaults.string(forKey: Self.mirrorStorageKey) ?? ""
    }

    var canModifyMirror: Bool {
        !isBusy
    }

    var canModifyGitHubToken: Bool {
        !isBusy && !isSavingGitHubToken
    }

    var isGitHubTokenConfigured: Bool {
        maskedGitHubToken != nil
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

    func loadGitHubTokenState() async {
        let token = await tokenStore.readGitHubToken()
        maskedGitHubToken = token.map(GitHubTokenRules.masked)
    }

    func updateGitHubTokenDraft(_ value: String) {
        guard canModifyGitHubToken else { return }
        gitHubTokenDraft = value
        gitHubTokenFeedbackText = nil
        gitHubTokenFeedbackIsError = false
    }

    func saveGitHubToken() async {
        guard canModifyGitHubToken else { return }
        guard let token = GitHubTokenRules.normalized(gitHubTokenDraft) else {
            gitHubTokenFeedbackText = "请输入有效的 GitHub 令牌，且令牌中不能包含空格"
            gitHubTokenFeedbackIsError = true
            return
        }

        isSavingGitHubToken = true
        defer { isSavingGitHubToken = false }
        do {
            try await tokenStore.saveGitHubToken(token)
            maskedGitHubToken = GitHubTokenRules.masked(token)
            gitHubTokenDraft = ""
            gitHubTokenFeedbackText = "令牌已保存在当前设备，并用于后续 GitHub 更新请求"
            gitHubTokenFeedbackIsError = false
            phase = .idle
        } catch {
            gitHubTokenFeedbackText = "令牌保存失败，请稍后重试"
            gitHubTokenFeedbackIsError = true
        }
    }

    func removeGitHubToken() async {
        guard canModifyGitHubToken else { return }

        isSavingGitHubToken = true
        defer { isSavingGitHubToken = false }
        do {
            try await tokenStore.clearGitHubToken()
            maskedGitHubToken = nil
            gitHubTokenDraft = ""
            gitHubTokenFeedbackText = "已移除当前设备保存的 GitHub 令牌"
            gitHubTokenFeedbackIsError = false
            phase = .idle
        } catch {
            gitHubTokenFeedbackText = "令牌移除失败，请稍后重试"
            gitHubTokenFeedbackIsError = true
        }
    }

    func checkForUpdate() async {
        guard !isBusy else { return }
        pendingLogRequestGeneration += 1
        isFetchingPendingUpdateLog = false
        pendingUpdateLogErrorText = nil
        phase = .checking
        do {
            let checkedRelease = try await service.checkForUpdate()
            release = checkedRelease
            if let checkedRelease {
                phase = .available
                pendingUpdate = checkedRelease
                await loadPendingUpdateLogIfNeeded(for: checkedRelease)
            } else {
                pendingUpdate = nil
                pendingUpdateLogErrorText = nil
                phase = .upToDate
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
            let fetchedLog = UpdateReleaseNotesText.normalized(
                try await service.fetchUpdateLog(for: currentVersion),
                version: currentVersion
            )
            guard !Task.isCancelled else { return }
            guard let fetchedLog, !fetchedLog.isEmpty else {
                updateLog = nil
                updateLogCache.clear(currentVersion: currentVersion)
                updateLogErrorText = "未找到当前版本的更新日志"
                return
            }

            updateLog = fetchedLog
            updateLogCache.save(fetchedLog, for: currentVersion)
        } catch {
            updateLogErrorText = Self.updateLogFailureMessage(error)
        }
    }

    /// 用户在更新确认窗里确认更新：关掉确认窗并自动完成下载与安装。
    func confirmUpdate() async {
        guard
            !isFetchingPendingUpdateLog,
            let confirmedRelease = pendingUpdate,
            UpdateReleaseNotesText.normalized(confirmedRelease.releaseNotes, version: confirmedRelease.version) != nil
        else { return }
        self.pendingUpdate = nil
        await download()
        guard phase == .downloaded else { return }
        install()
    }

    /// 用户关闭更新确认窗，保留下载入口但不自动安装。
    func dismissUpdatePrompt() {
        pendingLogRequestGeneration += 1
        isFetchingPendingUpdateLog = false
        pendingUpdate = nil
        pendingUpdateLogErrorText = nil
    }

    func retryPendingUpdateLog() async {
        guard let pendingUpdate else { return }
        await loadPendingUpdateLogIfNeeded(for: pendingUpdate, force: true)
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
                let cachedNotes = UpdateReleaseNotesText.normalized(
                    updateLogCache.read(currentVersion: release.version),
                    version: release.version
                )
                let notes = cachedNotes ?? UpdateReleaseNotesText.normalized(
                    release.releaseNotes,
                    version: release.version
                )
                if let notes {
                    updateLogCache.save(notes, for: release.version)
                }
                UpdateCompletionNotice.record(
                    release: release,
                    previousVersion: currentVersion,
                    notes: notes,
                    defaults: defaults
                )
            }
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
        case UpdateServiceError.gitHubAuthenticationFailed:
            "GitHub 令牌无效或已过期，请在“更新源”下方更新令牌"
        case UpdateServiceError.gitHubRateLimited:
            "GitHub 令牌的访问额度已用尽，请稍后重试或更换令牌"
        case is CancellationError:
            "操作已取消"
        default:
            "更新服务暂不可用，请稍后重试"
        }
    }

    private func loadPendingUpdateLogIfNeeded(for release: AppRelease, force: Bool = false) async {
        if !force,
           let cached = UpdateReleaseNotesText.normalized(
               updateLogCache.read(currentVersion: release.version),
               version: release.version
           ) {
            let enriched = release.replacingReleaseNotes(cached)
            self.release = enriched
            pendingUpdate = enriched
            pendingUpdateLogErrorText = nil
            return
        }

        if !force,
           let supplied = UpdateReleaseNotesText.normalized(release.releaseNotes, version: release.version) {
            updateLogCache.save(supplied, for: release.version)
            let enriched = release.replacingReleaseNotes(supplied)
            self.release = enriched
            pendingUpdate = enriched
            pendingUpdateLogErrorText = nil
            return
        }

        pendingLogRequestGeneration += 1
        let generation = pendingLogRequestGeneration
        isFetchingPendingUpdateLog = true
        pendingUpdateLogErrorText = nil
        defer {
            if pendingLogRequestGeneration == generation {
                isFetchingPendingUpdateLog = false
            }
        }

        do {
            let fetched = try await service.fetchUpdateLog(for: release.version)
            guard let notes = UpdateReleaseNotesText.normalized(fetched, version: release.version) else {
                guard !Task.isCancelled,
                      pendingLogRequestGeneration == generation,
                      pendingUpdate?.version == release.version
                else { return }
                pendingUpdateLogErrorText = "未找到该版本的更新日志"
                return
            }

            updateLogCache.save(notes, for: release.version)
            guard !Task.isCancelled,
                  pendingLogRequestGeneration == generation,
                  pendingUpdate?.version == release.version
            else { return }
            let enriched = release.replacingReleaseNotes(notes)
            self.release = enriched
            pendingUpdate = enriched
        } catch {
            guard !Task.isCancelled,
                  pendingLogRequestGeneration == generation,
                  pendingUpdate?.version == release.version
            else { return }
            pendingUpdateLogErrorText = Self.updateLogFailureMessage(error)
        }
    }

    private static func updateLogFailureMessage(_ error: Error) -> String {
        switch error {
        case UpdateServiceError.gitHubAuthenticationFailed:
            "GitHub 令牌无效或已过期，无法读取更新日志"
        case UpdateServiceError.gitHubRateLimited:
            "GitHub 令牌的访问额度已用尽，暂时无法读取更新日志"
        default:
            "获取更新日志失败，请稍后重试"
        }
    }

    var failureText: String? {
        if case let .failed(message) = phase {
            return message
        }
        return nil
    }
}

private extension AppRelease {
    func replacingReleaseNotes(_ releaseNotes: String?) -> AppRelease {
        AppRelease(
            version: version,
            tagName: tagName,
            releaseNotes: releaseNotes,
            publishedAt: publishedAt,
            assetName: assetName,
            downloadURL: downloadURL,
            checksumURL: checksumURL,
            sha256: sha256
        )
    }
}

/// 检测到新版本后的确认窗：展示该版本的更新日志，确认后自动下载安装。
private struct UpdatePromptView: View {
    let release: AppRelease
    let isLoadingReleaseNotes: Bool
    let releaseNotesErrorText: String?
    let onConfirm: () -> Void
    let onCancel: () -> Void
    let onRetryReleaseNotes: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("发现新版本 v\(release.version)")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))

            HStack(spacing: 8) {
                Image(systemName: "doc.text")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                Text("更新内容")
                    .qiankunjieFont(.labelLarge)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
            }

            if isLoadingReleaseNotes {
                HStack(spacing: 9) {
                    ProgressView()
                        .controlSize(.small)
                    Text("正在读取新版本更新日志…")
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            } else if !releaseNotes.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(UpdateReleaseNotesFormatter.lines(from: releaseNotes)) { line in
                            releaseNoteRow(line)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 280)
                .textSelection(.enabled)
            } else if let releaseNotesErrorText {
                VStack(alignment: .leading, spacing: 8) {
                    Text(releaseNotesErrorText)
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    Button("重新获取") {
                        onRetryReleaseNotes()
                    }
                }
            } else {
                Text("本次更新没有提供说明。")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
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
                .disabled(isLoadingReleaseNotes || releaseNotes.isEmpty)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 480)
        .background(QiankunjieColors.background(for: colorScheme))
    }

    private var releaseNotes: String {
        UpdateReleaseNotesText.normalized(release.releaseNotes, version: release.version) ?? ""
    }

    @ViewBuilder
    private func releaseNoteRow(_ line: UpdateReleaseNoteLine) -> some View {
        switch line.kind {
        case .heading:
            Text(line.text)
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
        case .bullet:
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Circle()
                    .fill(QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 5, height: 5)
                Text(line.text)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
        case .paragraph:
            Text(line.text)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct UpdateSettingsView: View {
    @State private var model: UpdateSettingsModel
    let currentVersion: String
    let updateCheckRequestID: Int

    init(
        currentVersion: String = QiankunjieMacMetadata.appVersion,
        updateCheckRequestID: Int = 0
    ) {
        self.currentVersion = currentVersion
        self.updateCheckRequestID = updateCheckRequestID
        _model = State(initialValue: UpdateSettingsModel(currentVersion: currentVersion))
    }

    init(
        currentVersion: String,
        service: any UpdateServicing,
        defaults: UserDefaults,
        updateCheckRequestID: Int = 0
    ) {
        self.currentVersion = currentVersion
        self.updateCheckRequestID = updateCheckRequestID
        _model = State(initialValue: UpdateSettingsModel(
            currentVersion: currentVersion,
            service: service,
            defaults: defaults
        ))
    }

    var body: some View {
        SettingsRow(title: "当前版本") {
            HStack(spacing: 10) {
                Text("v" + currentVersion)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .monospacedDigit()

                Button {
                    UpdateCompletionNoticeWindowController.shared.presentCurrentVersion(
                        version: currentVersion
                    )
                } label: {
                    Label("查看更新日志", systemImage: "doc.text")
                }
                .controlSize(.small)
                .help("查看当前版本的更新日志")

                Button {
                    Task {
                        await model.checkForUpdate()
                    }
                } label: {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(model.isBusy)
                .help(model.isBusy ? "正在检查更新" : "检查更新")
                .accessibilityLabel("检查更新")
            }
        }
        .task(id: updateCheckRequestID) {
            guard updateCheckRequestID > 0 else { return }
            await model.checkForUpdate()
        }
        .task {
            await model.loadGitHubTokenState()
        }
        .sheet(isPresented: updatePromptBinding) {
            if let release = model.pendingUpdate {
                UpdatePromptView(
                    release: release,
                    isLoadingReleaseNotes: model.isFetchingPendingUpdateLog,
                    releaseNotesErrorText: model.pendingUpdateLogErrorText,
                    onConfirm: {
                        Task {
                            await model.confirmUpdate()
                        }
                    },
                    onCancel: {
                        model.dismissUpdatePrompt()
                    },
                    onRetryReleaseNotes: {
                        Task {
                            await model.retryPendingUpdateLog()
                        }
                    }
                )
            }
        }

        updateStatus

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

        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text("GitHub 令牌")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                InteractiveInlineLinkText(
                    text: "配置后 GitHub API 限额由每小时 60 次提升到 5000 次。令牌只保存在当前设备，仅用于 api.github.com；公开仓库无需勾选权限。",
                    linkText: "GitHub API",
                    destination: URL(
                        string: "https://github.com/settings/tokens/new?description=Qiankunjie%20update%20check"
                    )!,
                    colorScheme: colorScheme
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(alignment: .leading, spacing: 8) {
                if let maskedToken = model.maskedGitHubToken {
                    HStack(spacing: 10) {
                        Text(maskedToken)
                            .qiankunjieFont(.bodyMedium)
                            .monospaced()
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        Spacer(minLength: 0)
                        Button("移除") {
                            Task {
                                await model.removeGitHubToken()
                            }
                        }
                        .disabled(!model.canModifyGitHubToken)
                    }
                } else {
                    HStack(spacing: 8) {
                        SecureField("GitHub Personal Access Token", text: Binding(
                            get: { model.gitHubTokenDraft },
                            set: { model.updateGitHubTokenDraft($0) }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .disabled(!model.canModifyGitHubToken)

                        Button("保存") {
                            Task {
                                await model.saveGitHubToken()
                            }
                        }
                        .disabled(
                            !model.canModifyGitHubToken
                                || model.gitHubTokenDraft.trimmingCharacters(
                                    in: .whitespacesAndNewlines
                                ).isEmpty
                        )
                    }
                }

                if model.isSavingGitHubToken {
                    ProgressView()
                        .controlSize(.small)
                }

                if let feedback = model.gitHubTokenFeedbackText {
                    Text(feedback)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(
                            model.gitHubTokenFeedbackIsError
                                ? (
                                    colorScheme == .dark
                                        ? QiankunjieColors.darkError
                                        : QiankunjieColors.lightError
                                )
                                : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                        )
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        SettingsRowDivider()
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

    @ViewBuilder
    private var updateStatus: some View {
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
                Label("发现新版本 v\(release.version)", systemImage: "arrow.down.circle.fill")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
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
        case let .failed(message):
            Text(message)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
        case .idle:
            EmptyView()
        }
    }
}
