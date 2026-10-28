import Charts
import Foundation
import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieNetworking
import SwiftUI

enum AiAPIRoute {
    static let settings = "ai/settings"
    static let discoverModels = "ai/models/discover"
    static let testSettings = "ai/settings/test"
    static let jobs = "ai/jobs"

    static func retryJob(_ jobID: Int) -> String {
        "ai/jobs/\(jobID)/retry"
    }
}

func aiStatusText(_ status: String?) -> String {
    switch status {
    case "disabled": "自动生成已关闭"
    case "not_configured": "未配置模型"
    case "queued": "AI 排队中"
    case "running": "AI 生成中"
    case "succeeded": "AI 已完成"
    case "failed": "AI 失败"
    default: "未生成"
    }
}

struct UserAiSettings: Decodable, Equatable, Sendable {
    let provider: String
    let model: String
    let baseUrl: String?
    let apiKeyConfigured: Bool
    let apiKeyLast4: String?
    let apiKeyUpdatedAt: String?
    let autoTriggerOnArchive: Bool
    let updatedAt: String
}

struct UserAiSettingsResponse: Decodable, Sendable {
    let settings: UserAiSettings?
}

struct SaveUserAiSettingsRequest: Encodable, Sendable {
    let provider: String
    let model: String
    let baseUrl: String?
    let apiKey: String?
    let autoTriggerOnArchive: Bool
}

struct DiscoverAiModelsRequest: Encodable, Sendable {
    let provider: String
    let baseUrl: String?
    let apiKey: String?
}

struct AiModelOption: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String?
}

struct DiscoverAiModelsResponse: Decodable, Sendable {
    let models: [AiModelOption]
    let cached: Bool
}

struct AiSettingsTestResponse: Decodable, Sendable {
    let ok: Bool
    let latencyMs: Int
}

struct AiSettingsDeleteResponse: Decodable, Sendable {
    let deleted: Bool
}

struct AiGenerationTypeUsageSummary: Decodable, Equatable, Identifiable, Sendable {
    let callType: String
    let jobs: Int
    let totalTokens: Int

    var id: String { callType }
}

struct AiGenerationDailyUsageSummary: Decodable, Equatable, Identifiable, Sendable {
    let date: String
    let jobs: Int
    let succeededJobs: Int
    let failedJobs: Int
    let totalTokens: Int

    var id: String { date }
}

struct AiGenerationUsageSummary: Decodable, Equatable, Sendable {
    let totalJobs: Int
    let succeededJobs: Int
    let failedJobs: Int
    let queuedJobs: Int
    let runningJobs: Int
    let promptTokens: Int
    let completionTokens: Int
    let totalTokens: Int
    let averageDurationMs: Int
    let byType: [AiGenerationTypeUsageSummary]
    let daily: [AiGenerationDailyUsageSummary]
}

struct AiJobSummary: Decodable, Equatable, Identifiable, Sendable {
    let id: Int
    let articleId: Int
    let articleTitle: String?
    let triggerType: String
    let callType: String
    let includeCategory: Bool
    let status: String
    let errorCode: String?
    let errorMessage: String?
    let provider: String
    let model: String
    let promptTokens: Int?
    let completionTokens: Int?
    let totalTokens: Int?
    let createdAt: String
    let startedAt: String?
    let finishedAt: String?
    let durationMs: Int?
}

struct AiJobsResponse: Decodable, Sendable {
    let jobs: [AiJobSummary]
    let total: Int
    let usage: AiGenerationUsageSummary
}

struct AiJobRetryResponse: Decodable, Sendable {
    let ok: Bool
}

@MainActor
@Observable
final class AiSettingsModel {
    private(set) var settings: UserAiSettings?
    private(set) var models: [AiModelOption] = []
    private(set) var jobs: [AiJobSummary] = []
    private(set) var usage: AiGenerationUsageSummary?
    private(set) var totalJobs = 0
    private(set) var currentPage = 1
    private(set) var isLoading = true
    private(set) var isLoadingJobs = false
    private(set) var isSaving = false
    private(set) var isTesting = false
    private(set) var isDeleting = false
    private(set) var isDiscovering = false
    private(set) var retryingJobID: Int?
    var provider = "deepseek"
    var baseUrl = ""
    var apiKey = ""
    var model = ""
    var autoTriggerOnArchive = false
    var errorMessage: String?
    var noticeMessage: String?
    var jobsErrorMessage: String?
    var jobsNoticeMessage: String?
    var isDeleteConfirming = false

    let pageSize = 10
    private let client: ManagementAPIClient
#if DEBUG
    private var previewJobsByPage: [Int: [AiJobSummary]] = [:]
#endif

    init(repository: AuthRepository) {
        client = ManagementAPIClient(repository: repository)
    }

    var totalPages: Int {
        max(1, Int(ceil(Double(totalJobs) / Double(pageSize))))
    }

    var canGoToPreviousPage: Bool {
        currentPage > 1 && !isLoadingJobs
    }

    var canGoToNextPage: Bool {
        currentPage < totalPages && !isLoadingJobs
    }

    var hasSavedAPIKey: Bool {
        settings?.apiKeyConfigured == true
    }

    var hasAvailableAPIKey: Bool {
        normalizedAPIKey != nil || hasSavedAPIKey
    }

    var canDiscoverModels: Bool {
        !provider.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && hasAvailableAPIKey
            && !isDiscovering
            && !isLoading
    }

    var canSave: Bool {
        !provider.trimmingCharacters(in: .whitespaces).isEmpty
            && !model.trimmingCharacters(in: .whitespaces).isEmpty
            && hasAvailableAPIKey
            && !isSaving
    }

    var canTest: Bool {
        !provider.trimmingCharacters(in: .whitespaces).isEmpty
            && !model.trimmingCharacters(in: .whitespaces).isEmpty
            && hasAvailableAPIKey
            && !isTesting
            && !isLoading
    }

    var hasActiveJobs: Bool {
        jobs.contains { $0.status == "queued" || $0.status == "running" }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        noticeMessage = nil
        defer { isLoading = false }

        do {
            let response: UserAiSettingsResponse = try await client.get(AiAPIRoute.settings)
            applySettings(response.settings)
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }

        await loadJobs(page: 1)
    }

    func loadJobs(page: Int, showSpinner: Bool = true) async {
        guard !isLoadingJobs else { return }
        if showSpinner {
            isLoadingJobs = true
        }
        jobsErrorMessage = nil
        jobsNoticeMessage = nil
        defer {
            if showSpinner {
                isLoadingJobs = false
            }
        }

#if DEBUG
        if let previewJobs = previewJobsByPage[page] {
            jobs = previewJobs
            currentPage = page
            return
        }
#endif

        do {
            let response: AiJobsResponse = try await client.get(
                AiAPIRoute.jobs,
                queryItems: [
                    URLQueryItem(name: "page", value: String(page)),
                    URLQueryItem(name: "perPage", value: String(pageSize)),
                ]
            )
            jobs = response.jobs
            totalJobs = response.total
            usage = response.usage
            currentPage = page
        } catch {
            jobsErrorMessage = managementErrorMessage(for: error)
        }
    }

    func refreshJobs() async {
        await loadJobs(page: currentPage)
    }

    func refreshJobsSilently() async {
        await loadJobs(page: currentPage, showSpinner: false)
    }

    func previousPage() async {
        guard canGoToPreviousPage else { return }
        await loadJobs(page: currentPage - 1)
    }

    func nextPage() async {
        guard canGoToNextPage else { return }
        await loadJobs(page: currentPage + 1)
    }

    func discoverModels() async {
        guard canDiscoverModels else {
            errorMessage = "请先填写 API Key，再获取模型清单"
            return
        }
        isDiscovering = true
        errorMessage = nil
        noticeMessage = nil
        defer { isDiscovering = false }

        do {
            let request = DiscoverAiModelsRequest(
                provider: provider,
                baseUrl: normalizedURL,
                apiKey: normalizedAPIKey
            )
            let response: DiscoverAiModelsResponse = try await client.send(
                AiAPIRoute.discoverModels,
                method: .post,
                body: request
            )
            let uniqueModels = Dictionary(
                response.models.map { ($0.id, $0) },
                uniquingKeysWith: { _, latest in latest }
            ).values
            models = uniqueModels.sorted {
                let left = $0.name ?? $0.id
                let right = $1.name ?? $1.id
                return left.localizedStandardCompare(right) == .orderedAscending
            }
            if models.isEmpty {
                noticeMessage = "模型服务没有返回可选清单，请直接手动输入模型名"
            } else {
                noticeMessage = response.cached
                    ? "已读取缓存的模型清单，共 \(models.count) 个"
                    : "模型清单已更新，共 \(models.count) 个"
            }
        } catch {
            models = []
            errorMessage = "获取模型清单失败：\(managementErrorMessage(for: error))"
        }
    }

    func clearDiscoveredModels() {
        models = []
    }

    func save() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil
        noticeMessage = nil
        defer { isSaving = false }

        do {
            let request = SaveUserAiSettingsRequest(
                provider: provider.trimmingCharacters(in: .whitespaces),
                model: model.trimmingCharacters(in: .whitespaces),
                baseUrl: normalizedURL,
                apiKey: normalizedAPIKey,
                autoTriggerOnArchive: autoTriggerOnArchive
            )
            let response: UserAiSettingsResponse = try await client.send(
                AiAPIRoute.settings,
                method: .put,
                body: request
            )
            applySettings(response.settings)
            apiKey = ""
            noticeMessage = "AI 配置已保存"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func test() async {
        guard canTest else { return }
        isTesting = true
        errorMessage = nil
        noticeMessage = nil
        defer { isTesting = false }

        do {
            let body = SaveUserAiSettingsRequest(
                provider: provider,
                model: model,
                baseUrl: normalizedURL,
                apiKey: normalizedAPIKey,
                autoTriggerOnArchive: autoTriggerOnArchive
            )
            let response: AiSettingsTestResponse = try await client.send(
                AiAPIRoute.testSettings,
                method: .post,
                body: body
            )
            noticeMessage = "连接正常，模型响应耗时 \(response.latencyMs) ms"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func delete() async {
        isDeleting = true
        errorMessage = nil
        noticeMessage = nil
        defer { isDeleting = false }

        do {
            let _: AiSettingsDeleteResponse = try await client.delete(AiAPIRoute.settings)
            applySettings(nil)
            models = []
            autoTriggerOnArchive = false
            noticeMessage = "AI 配置已删除"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func retry(_ job: AiJobSummary) async {
        guard retryingJobID == nil else { return }
        retryingJobID = job.id
        jobsErrorMessage = nil
        jobsNoticeMessage = nil
        defer { retryingJobID = nil }

        do {
            let _: AiJobRetryResponse = try await client.send(
                AiAPIRoute.retryJob(job.id),
                method: .post,
                body: EmptyRequestBody()
            )
            jobsNoticeMessage = "任务 #\(job.id) 已重新排队"
            await loadJobs(page: currentPage, showSpinner: false)
        } catch {
            jobsErrorMessage = managementErrorMessage(for: error)
        }
    }

    private func applySettings(_ value: UserAiSettings?) {
        settings = value
        guard let value else {
            provider = "deepseek"
            baseUrl = ""
            model = ""
            autoTriggerOnArchive = false
            return
        }
        provider = value.provider
        baseUrl = value.baseUrl ?? ""
        model = value.model
        autoTriggerOnArchive = value.autoTriggerOnArchive
    }

#if DEBUG
    func configureForPreview(
        settings: UserAiSettings,
        models: [AiModelOption],
        jobs: [AiJobSummary],
        usage: AiGenerationUsageSummary,
        totalJobs: Int,
        previewJobsByPage: [Int: [AiJobSummary]] = [:]
    ) {
        applySettings(settings)
        self.models = models
        self.previewJobsByPage = previewJobsByPage
        self.previewJobsByPage[1] = jobs
        self.jobs = self.previewJobsByPage[1] ?? jobs
        self.usage = usage
        self.totalJobs = totalJobs
        self.currentPage = 1
        self.isLoading = false
        self.isLoadingJobs = false
    }
#endif

    private var normalizedURL: String? {
        let value = baseUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private var normalizedAPIKey: String? {
        let value = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private struct EmptyRequestBody: Encodable, Sendable {}

private struct AiStatusSlice: Identifiable {
    let id: String
    let label: String
    let count: Int
    let color: Color
}

private struct AiMetricCard: View {
    let title: String
    let value: String
    let detail: String
    let systemImage: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: systemImage)
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                Text(title)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Text(value)
                .qiankunjieFont(.headlineSmall)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .monospacedDigit()

            Text(detail)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .lineLimit(1)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.44),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }
}

private struct AiMessageBanner: View {
    let text: String
    let isError: Bool
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .foregroundStyle(isError ? errorColor : successColor)
            Text(text)
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(
                    isError
                        ? errorColor
                        : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                )
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(
            (isError ? errorColor : successColor).opacity(colorScheme == .dark ? 0.12 : 0.08),
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 9)
                .strokeBorder((isError ? errorColor : successColor).opacity(0.28))
        }
    }

    private var errorColor: Color {
        colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError
    }

    private var successColor: Color {
        Color(hex: colorScheme == .dark ? 0x78C89A : 0x3F8C63)
    }
}

struct AiSettingsView: View {
    static let deleteConfirmationTitle = "确定删除 AI 配置？"
    static let deleteConfirmationMessage = "删除后归档将不再自动生成 AI 摘要。"

    private static let providers = [
        ("anthropic", "Anthropic"),
        ("deepseek", "DeepSeek"),
        ("zhipu", "智谱 AI"),
        ("minimax", "MiniMax"),
        ("kimi", "Kimi"),
        ("doubao", "豆包"),
        ("openrouter", "OpenRouter"),
        ("nvidia", "NVIDIA"),
        ("aliyun", "阿里云"),
        ("siliconflow", "SiliconFlow"),
        ("custom", "自定义"),
    ]

    private static let jobTableMinimumWidth: CGFloat = 800

    @State private var model: AiSettingsModel
    @State private var modelSearch = ""
    private let loadsInitialData: Bool
    @Environment(\.colorScheme) private var colorScheme

    init(repository: AuthRepository) {
        _model = State(initialValue: AiSettingsModel(repository: repository))
        loadsInitialData = true
    }

#if DEBUG
    init(previewModel: AiSettingsModel) {
        _model = State(initialValue: previewModel)
        loadsInitialData = false
    }
#endif

    var body: some View {
        SettingsPage {
            modelConfigurationPanel
            usageOverviewPanel
            recentJobsPanel
        }
        .task {
            guard loadsInitialData else { return }
            await model.load()
        }
        .task(id: model.hasActiveJobs) {
            guard model.hasActiveJobs else { return }
            while !Task.isCancelled && model.hasActiveJobs {
                try? await Task.sleep(for: .seconds(3))
                guard !Task.isCancelled else { return }
                await model.refreshJobsSilently()
            }
        }
        .confirmationDialog(
            Self.deleteConfirmationTitle,
            isPresented: $model.isDeleteConfirming,
            titleVisibility: .visible
        ) {
            Button("删除配置", role: .destructive) {
                Task { await model.delete() }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text(Self.deleteConfirmationMessage)
        }
        .onChange(of: model.provider) { oldValue, newValue in
            if oldValue != newValue {
                model.clearDiscoveredModels()
                modelSearch = ""
            }
        }
        .onChange(of: model.baseUrl) { oldValue, newValue in
            if oldValue != newValue {
                model.clearDiscoveredModels()
                modelSearch = ""
            }
        }
    }

    private var modelConfigurationPanel: some View {
        WorkspacePanel(
            title: "模型配置",
            subtitle: "填写连接信息，获取模型清单后选择或直接输入模型名。",
            systemImage: "sparkles"
        ) {
            SettingsRow(
                title: "模型提供商",
                subtitle: "切换提供商会重新加载该服务的模型清单。"
            ) {
                Picker("模型提供商", selection: $model.provider) {
                    ForEach(Self.providers, id: \.0) { provider in
                        Text(provider.1).tag(provider.0)
                    }
                }
                .labelsHidden()
            }

            SettingsRowDivider()

            SettingsBlockRow(
                title: "Base URL",
                subtitle: "使用官方地址时留空；自定义或代理服务填写完整 HTTPS 地址。"
            ) {
                TextField("Base URL", text: $model.baseUrl, prompt: Text("https://…"))
                    .textFieldStyle(.roundedBorder)
            }

            SettingsRowDivider()

            apiKeySection

            SettingsRowDivider()

            modelDiscoverySection

            SettingsRowDivider()

            SettingsRow(title: "自动触发", subtitle: "归档文章时自动生成 AI 摘要、标签，并按需分类。") {
                Toggle("自动触发", isOn: $model.autoTriggerOnArchive)
                    .toggleStyle(.switch)
                    .labelsHidden()
            }

            if let errorMessage = model.errorMessage {
                AiMessageBanner(text: errorMessage, isError: true)
            }

            if let noticeMessage = model.noticeMessage {
                AiMessageBanner(text: noticeMessage, isError: false)
            }

            SettingsRowDivider()

            SettingsActionsRow {
                Button {
                    Task { await model.test() }
                } label: {
                    if model.isTesting {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("测试中")
                        }
                    } else {
                        Label("测试连接", systemImage: "bolt")
                    }
                }
                .disabled(!model.canTest)

                Button("删除配置", role: .destructive) {
                    model.isDeleteConfirming = true
                }
                .disabled(model.isDeleting || model.isLoading || model.settings == nil)

                Button {
                    Task { await model.save() }
                } label: {
                    if model.isSaving {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("保存中")
                        }
                    } else {
                        Text("保存配置")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!model.canSave || model.isLoading)
            }
        }
    }

    private var apiKeySection: some View {
        SettingsBlockRow(
            title: "API Key",
            subtitle: model.hasSavedAPIKey
                ? "账户中已有 Key。留空会继续使用已保存的 Key。"
                : "Key 只保存在服务端，不会回传到客户端。"
        ) {
            HStack(spacing: 10) {
                SecureField("API Key", text: $model.apiKey, prompt: Text(apiKeyPlaceholder))
                    .textFieldStyle(.roundedBorder)

                if let savedKeyText {
                    Label(savedKeyText, systemImage: "checkmark.shield")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(
                            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.62),
                            in: Capsule()
                        )
                        .fixedSize()
                }
            }
        }
    }

    private var modelDiscoverySection: some View {
        SettingsBlockRow(
            title: "模型名称",
            subtitle: "可先获取模型清单再勾选；服务未提供模型接口时仍可手动输入。"
        ) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    TextField("模型", text: $model.model, prompt: Text("请输入或选择模型名"))
                        .textFieldStyle(.roundedBorder)

                    Button {
                        Task { await model.discoverModels() }
                    } label: {
                        if model.isDiscovering {
                            HStack(spacing: 6) {
                                ProgressView().controlSize(.small)
                                Text("获取中")
                            }
                        } else {
                            Label(
                                model.models.isEmpty ? "获取模型清单" : "刷新清单",
                                systemImage: "arrow.clockwise"
                            )
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!model.canDiscoverModels)
                    .help(
                        model.hasAvailableAPIKey
                            ? "从当前模型服务获取可用模型"
                            : "请先填写 API Key"
                    )
                }

                if !model.hasAvailableAPIKey {
                    Text("填写 API Key 后可获取模型清单。")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }

                if model.isDiscovering {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("正在读取模型服务返回的清单…")
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                    .padding(.vertical, 4)
                }

                if !model.models.isEmpty {
                    discoveredModelList
                }
            }
        }
    }

    private var discoveredModelList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

                TextField("筛选模型", text: $modelSearch)
                    .textFieldStyle(.plain)

                if !modelSearch.isEmpty {
                    Button {
                        modelSearch = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                    }
                    .buttonStyle(QiankunjiePlainButtonStyle())
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .help("清除筛选")
                }

                Text("\(filteredModels.count) / \(model.models.count)")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .monospacedDigit()
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 7)
            .background(
                QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.5),
                in: RoundedRectangle(cornerRadius: 8)
            )

            if filteredModels.isEmpty {
                Text("没有匹配的模型，可直接在上方手动输入。")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(filteredModels) { option in
                            modelOptionRow(option)
                        }
                    }
                }
                .frame(maxHeight: 190)
            }
        }
        .padding(10)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.26),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func modelOptionRow(_ option: AiModelOption) -> some View {
        let isSelected = option.id == model.model

        return Button {
            model.model = option.id
        } label: {
            HStack(spacing: 9) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(
                        isSelected
                            ? QiankunjieColors.accent(for: colorScheme)
                            : QiankunjieColors.onSurfaceVariant(for: colorScheme)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(option.name ?? option.id)
                        .qiankunjieFont(.bodyMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(1)

                    if let name = option.name, name != option.id {
                        Text(option.id)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                if isSelected {
                    Text("已选择")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isSelected
                    ? QiankunjieColors.accent(for: colorScheme).opacity(0.11)
                    : QiankunjieColors.surface(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(
                        isSelected
                            ? QiankunjieColors.accent(for: colorScheme).opacity(0.45)
                            : QiankunjieColors.outline(for: colorScheme)
                    )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(QiankunjiePlainButtonStyle())
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var usageOverviewPanel: some View {
        WorkspacePanel(
            title: "用量概览",
            subtitle: "全部任务的调用结果、类型占比与近 14 天趋势。",
            systemImage: "chart.bar.xaxis"
        ) {
            if let usage = model.usage {
                usageOverview(usage)
            } else if model.isLoadingJobs {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("正在统计任务数据…")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                .frame(maxWidth: .infinity, minHeight: 110)
            } else {
                emptyMessage("暂无任务数据")
            }
        }
    }

    private func usageOverview(_ usage: AiGenerationUsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 150), spacing: 10)],
                spacing: 10
            ) {
                AiMetricCard(
                    title: "总调用",
                    value: usage.totalJobs.formatted(),
                    detail: "成功 \(usage.succeededJobs.formatted()) · 失败 \(usage.failedJobs.formatted())",
                    systemImage: "sum"
                )
                AiMetricCard(
                    title: "成功率",
                    value: successRateText(usage),
                    detail: "进行中 \(usage.runningJobs + usage.queuedJobs) 次",
                    systemImage: "checkmark.seal"
                )
                AiMetricCard(
                    title: "总 Token",
                    value: usage.totalTokens.formatted(),
                    detail: "输入 \(usage.promptTokens.formatted()) · 输出 \(usage.completionTokens.formatted())",
                    systemImage: "number"
                )
                AiMetricCard(
                    title: "平均耗时",
                    value: formatMilliseconds(usage.averageDurationMs),
                    detail: "从开始生成到结束",
                    systemImage: "timer"
                )
            }

            if usage.totalJobs == 0 {
                emptyMessage("完成一次 AI 生成后，这里会显示图表。")
            } else {
                HStack(alignment: .top, spacing: 12) {
                    chartCard(title: "调用结果", subtitle: "成功、失败与进行中任务占比") {
                        statusChart(usage)
                    }

                    chartCard(title: "调用类型", subtitle: "按摘要、分类与 MCP 调用统计") {
                        callTypeChart(usage)
                    }
                }

                chartCard(title: "近 14 天调用趋势", subtitle: "按任务创建日期统计调用量") {
                    dailyTrendChart(usage.daily)
                }
            }
        }
    }

    private func statusChart(_ usage: AiGenerationUsageSummary) -> some View {
        let slices = statusSlices(usage)

        return HStack(spacing: 16) {
            Chart(slices) { slice in
                SectorMark(
                    angle: .value("任务", slice.count),
                    innerRadius: .ratio(0.62),
                    angularInset: 2
                )
                .foregroundStyle(slice.color)
            }
            .chartLegend(.hidden)
            .frame(width: 150, height: 150)
            .overlay {
                VStack(spacing: 2) {
                    Text(successRateText(usage))
                        .qiankunjieFont(.headlineSmall)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .monospacedDigit()
                    Text("成功率")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }

            VStack(alignment: .leading, spacing: 9) {
                ForEach(slices) { slice in
                    HStack(spacing: 7) {
                        Circle()
                            .fill(slice.color)
                            .frame(width: 8, height: 8)
                        Text(slice.label)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        Spacer(minLength: 8)
                        Text(slice.count.formatted())
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                            .monospacedDigit()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
    }

    private func callTypeChart(_ usage: AiGenerationUsageSummary) -> some View {
        Group {
            if usage.byType.isEmpty {
                emptyMessage("暂无调用类型数据")
            } else {
                Chart(usage.byType) { item in
                    BarMark(
                        x: .value("调用次数", item.jobs),
                        y: .value("调用类型", callTypeName(item.callType))
                    )
                    .foregroundStyle(callTypeColor(item.callType))
                    .cornerRadius(4)
                    .annotation(position: .trailing, alignment: .leading) {
                        Text(item.jobs.formatted())
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .monospacedDigit()
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }
                .frame(height: max(132, CGFloat(usage.byType.count) * 42))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 150)
    }

    private func dailyTrendChart(_ daily: [AiGenerationDailyUsageSummary]) -> some View {
        Group {
            if daily.isEmpty {
                emptyMessage("近 14 天暂无调用")
            } else {
                Chart(daily) { item in
                    AreaMark(
                        x: .value("日期", shortChartDate(item.date)),
                        y: .value("任务数", item.jobs)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                QiankunjieColors.accent(for: colorScheme).opacity(0.24),
                                QiankunjieColors.accent(for: colorScheme).opacity(0.02),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)

                    LineMark(
                        x: .value("日期", shortChartDate(item.date)),
                        y: .value("任务数", item.jobs)
                    )
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    .lineStyle(StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("日期", shortChartDate(item.date)),
                        y: .value("任务数", item.jobs)
                    )
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    .symbolSize(24)
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                        AxisGridLine()
                            .foregroundStyle(QiankunjieColors.outline(for: colorScheme).opacity(0.5))
                        AxisValueLabel()
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisGridLine()
                            .foregroundStyle(QiankunjieColors.outline(for: colorScheme).opacity(0.55))
                        AxisValueLabel()
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                }
                .frame(height: 190)
            }
        }
    }

    private func chartCard<Content: View>(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .qiankunjieFont(.labelLarge)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Text(subtitle)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            content()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.24),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var recentJobsPanel: some View {
        WorkspacePanel(
            title: "最近任务",
            subtitle: "每页 10 条，包含调用时间、结果、类型、文章、模型和 Token。",
            systemImage: "clock.arrow.circlepath",
            headerAccessory: {
                Button {
                    Task { await model.refreshJobs() }
                } label: {
                    if model.isLoadingJobs {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("刷新", systemImage: "arrow.clockwise")
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(model.isLoadingJobs)
            }
        ) {
            if let jobsErrorMessage = model.jobsErrorMessage {
                AiMessageBanner(text: jobsErrorMessage, isError: true)
            }

            if let jobsNoticeMessage = model.jobsNoticeMessage {
                AiMessageBanner(text: jobsNoticeMessage, isError: false)
            }

            if model.isLoadingJobs && model.jobs.isEmpty {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("正在加载任务记录…")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            } else if model.jobs.isEmpty {
                emptyMessage("还没有生成记录")
            } else {
                jobTable
                SettingsRowDivider()
                paginationBar
            }
        }
    }

    private var jobTable: some View {
        ScrollView(.horizontal) {
            VStack(spacing: 0) {
                jobTableHeader

                ForEach(Array(model.jobs.enumerated()), id: \.element.id) { index, job in
                    Divider()
                    jobTableRow(job, index: index)
                }
            }
            .frame(minWidth: Self.jobTableMinimumWidth)
            .containerRelativeFrame(.horizontal, alignment: .leading) { length, _ in
                max(Self.jobTableMinimumWidth, length)
            }
            .background(
                QiankunjieColors.surface(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(QiankunjieColors.outline(for: colorScheme))
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private var jobTableHeader: some View {
        HStack(alignment: .center, spacing: 8) {
            headerCell("时间", width: 94)
            headerCell("结果", width: 64)
            headerCell("调用类型", width: 104)
            headerCell("来源", width: 56)
            headerCell("文章", minWidth: 140)
            headerCell("模型", width: 96)
            headerCell("Token", width: 62)
            headerCell("耗时", width: 58)
            Spacer(minLength: 28)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.54))
    }

    private func jobTableRow(_ job: AiJobSummary, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 8) {
                Text(compactDisplayDate(job.createdAt))
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .monospacedDigit()
                    .frame(width: 94, alignment: .leading)
                    .help(displayDate(job.createdAt))

                jobStatusBadge(job.status)
                    .frame(width: 64, alignment: .leading)

                Text(callTypeName(job.callType))
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .lineLimit(1)
                    .frame(width: 104, alignment: .leading)

                Text(triggerName(job.triggerType))
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .frame(width: 56, alignment: .leading)

                VStack(alignment: .leading, spacing: 2) {
                    Text(articleTitle(job))
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(2)
                    Text("#\(job.articleId)")
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .monospacedDigit()
                }
                .frame(minWidth: 140, maxWidth: .infinity, alignment: .leading)

                Text(job.model)
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .lineLimit(2)
                    .frame(width: 96, alignment: .leading)
                    .help("\(job.provider) · \(job.model)")

                Text(job.totalTokens?.formatted() ?? "—")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .monospacedDigit()
                    .frame(width: 62, alignment: .leading)
                    .help(tokenDetail(job))

                Text(job.durationMs.map(formatMilliseconds) ?? "—")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    .monospacedDigit()
                    .frame(width: 58, alignment: .leading)

                if job.status == "failed" {
                    Button {
                        Task { await model.retry(job) }
                    } label: {
                        if model.retryingJobID == job.id {
                            ProgressView().controlSize(.mini)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .buttonStyle(.borderless)
                    .disabled(model.retryingJobID != nil)
                    .help("重试任务 #\(job.id)")
                    .frame(width: 28)
                } else {
                    Color.clear
                        .frame(width: 28, height: 1)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)

            if let errorMessage = job.errorMessage, !errorMessage.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                    Text("\(job.errorCode ?? "AI_ERROR") · \(errorMessage)")
                        .lineLimit(3)
                    Spacer(minLength: 0)
                }
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(
                    colorScheme == .dark
                        ? QiankunjieColors.darkError
                        : QiankunjieColors.lightError
                )
                .padding(.leading, 108)
                .padding(.trailing, 10)
                .padding(.bottom, 9)
            }
        }
        .background(
            index.isMultiple(of: 2)
                ? QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.18)
                : Color.clear
        )
    }

    private var paginationBar: some View {
        HStack(spacing: 10) {
            Text("共 \(model.totalJobs) 条 · 第 \(model.currentPage) / \(model.totalPages) 页")
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                .monospacedDigit()

            Spacer(minLength: 12)

            Button {
                Task { await model.previousPage() }
            } label: {
                Label("上一页", systemImage: "chevron.left")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(!model.canGoToPreviousPage)

            Button {
                Task { await model.nextPage() }
            } label: {
                Label("下一页", systemImage: "chevron.right")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(!model.canGoToNextPage)
        }
    }

    private func headerCell(_ title: String, width: CGFloat) -> some View {
        Text(title)
            .qiankunjieFont(.labelMedium)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .frame(width: width, alignment: .leading)
    }

    private func headerCell(_ title: String, minWidth: CGFloat) -> some View {
        Text(title)
            .qiankunjieFont(.labelMedium)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .frame(minWidth: minWidth, maxWidth: minWidth, alignment: .leading)
    }

    private func jobStatusBadge(_ status: String) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(jobStatusColor(status))
                .frame(width: 6, height: 6)
            Text(jobStatusName(status))
                .qiankunjieFont(.labelMedium)
                .foregroundStyle(jobStatusColor(status))
                .lineLimit(1)
        }
    }

    private func emptyMessage(_ text: String) -> some View {
        Text(text)
            .qiankunjieFont(.labelMedium)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .frame(maxWidth: .infinity, minHeight: 110)
            .background(
                QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.2),
                in: RoundedRectangle(cornerRadius: 9)
            )
    }

    private var filteredModels: [AiModelOption] {
        let keyword = modelSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyword.isEmpty else { return model.models }
        return model.models.filter {
            $0.id.localizedCaseInsensitiveContains(keyword)
                || ($0.name?.localizedCaseInsensitiveContains(keyword) ?? false)
        }
    }

    private var savedKeyText: String? {
        guard let settings = model.settings, settings.apiKeyConfigured else { return nil }
        if let last4 = settings.apiKeyLast4, !last4.isEmpty {
            return "已保存 ····\(last4)"
        }
        return "已保存"
    }

    private var apiKeyPlaceholder: String {
        guard model.hasSavedAPIKey else { return "输入 API Key" }
        if let last4 = model.settings?.apiKeyLast4, !last4.isEmpty {
            return "已保存 ····\(last4)，留空沿用"
        }
        return "已保存 Key，留空沿用"
    }

    private func statusSlices(_ usage: AiGenerationUsageSummary) -> [AiStatusSlice] {
        [
            AiStatusSlice(
                id: "succeeded",
                label: "成功",
                count: usage.succeededJobs,
                color: Color(hex: colorScheme == .dark ? 0x78C89A : 0x3F8C63)
            ),
            AiStatusSlice(
                id: "failed",
                label: "失败",
                count: usage.failedJobs,
                color: colorScheme == .dark
                    ? QiankunjieColors.darkError
                    : QiankunjieColors.lightError
            ),
            AiStatusSlice(
                id: "pending",
                label: "进行中",
                count: usage.queuedJobs + usage.runningJobs,
                color: Color(hex: colorScheme == .dark ? 0xD9B85C : 0xB5812E)
            ),
        ].filter { $0.count > 0 }
    }

    private func callTypeColor(_ callType: String) -> Color {
        switch callType {
        case "summary_and_category":
            Color(hex: colorScheme == .dark ? 0x78C89A : 0x4F8A70)
        case "mcp_summary":
            Color(hex: colorScheme == .dark ? 0xD9B85C : 0xB5812E)
        default:
            QiankunjieColors.accent(for: colorScheme)
        }
    }

    private func jobStatusColor(_ status: String) -> Color {
        switch status {
        case "succeeded":
            Color(hex: colorScheme == .dark ? 0x78C89A : 0x3F8C63)
        case "failed":
            colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError
        case "running":
            Color(hex: colorScheme == .dark ? 0xD9B85C : 0xB5812E)
        default:
            QiankunjieColors.onSurfaceVariant(for: colorScheme)
        }
    }

    private func jobStatusName(_ status: String) -> String {
        switch status {
        case "succeeded": "成功"
        case "failed": "失败"
        case "running": "运行中"
        case "queued": "排队"
        default: status
        }
    }

    private func callTypeName(_ callType: String) -> String {
        switch callType {
        case "summary_and_category": "摘要 + 分类"
        case "mcp_summary": "MCP 摘要"
        case "summary": "摘要 + 标签"
        default: "其他调用"
        }
    }

    private func triggerName(_ triggerType: String) -> String {
        switch triggerType {
        case "archive": "归档"
        case "manual": "手动"
        case "admin": "管理员"
        case "mcp_summary": "MCP"
        default: triggerType
        }
    }

    private func articleTitle(_ job: AiJobSummary) -> String {
        let title = job.articleTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return title.isEmpty ? "无标题文章" : title
    }

    private func tokenDetail(_ job: AiJobSummary) -> String {
        guard job.totalTokens != nil || job.promptTokens != nil || job.completionTokens != nil else {
            return "模型未返回 Token 用量"
        }
        return "输入 \(job.promptTokens ?? 0) · 输出 \(job.completionTokens ?? 0) · 合计 \(job.totalTokens ?? 0)"
    }

    private func successRateText(_ usage: AiGenerationUsageSummary) -> String {
        guard usage.totalJobs > 0 else { return "—" }
        let rate = Double(usage.succeededJobs) / Double(usage.totalJobs)
        return rate.formatted(.percent.precision(.fractionLength(0)))
    }

    private func formatMilliseconds(_ milliseconds: Int) -> String {
        if milliseconds <= 0 {
            return "—"
        }
        if milliseconds < 1_000 {
            return "\(milliseconds) ms"
        }
        if milliseconds < 60_000 {
            return String(format: "%.1f 秒", Double(milliseconds) / 1_000)
        }
        let minutes = milliseconds / 60_000
        let seconds = (milliseconds % 60_000) / 1_000
        return "\(minutes) 分 \(seconds) 秒"
    }

    private func shortChartDate(_ raw: String) -> String {
        guard raw.count == 10 else { return raw }
        let parts = raw.split(separator: "-")
        guard parts.count == 3 else { return raw }
        return "\(Int(parts[1]) ?? 0)/\(Int(parts[2]) ?? 0)"
    }

    /// 后端返回 ISO8601 字符串，界面上转成易读的本地时间。
    static func displayDate(_ raw: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return raw }
        return date.formatted(.dateTime.year().month().day().hour().minute())
    }

    private func displayDate(_ raw: String) -> String {
        Self.displayDate(raw)
    }

    private func compactDisplayDate(_ raw: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return raw }
        return date.formatted(.dateTime.month(.twoDigits).day(.twoDigits).hour().minute())
    }
}
