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

struct AiGenerationUsageSummary: Decodable, Equatable, Sendable {
    let totalJobs: Int
    let succeededJobs: Int
    let failedJobs: Int
    let totalTokens: Int
}

struct AiJobSummary: Decodable, Equatable, Identifiable, Sendable {
    let id: Int
    let articleId: Int
    let status: String
    let errorCode: String?
    let errorMessage: String?
    let model: String
    let totalTokens: Int?
    let createdAt: String
    let finishedAt: String?
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
    private(set) var isLoading = true
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
    var isDeleteConfirming = false

    private let client: ManagementAPIClient

    init(repository: AuthRepository) {
        client = ManagementAPIClient(repository: repository)
    }

    var canSave: Bool {
        !provider.trimmingCharacters(in: .whitespaces).isEmpty
            && !model.trimmingCharacters(in: .whitespaces).isEmpty
            && !isSaving
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        noticeMessage = nil
        defer { isLoading = false }

        do {
            let response: UserAiSettingsResponse = try await client.get(AiAPIRoute.settings)
            applySettings(response.settings)
            let jobResponse: AiJobsResponse? = try? await client.get(
                AiAPIRoute.jobs,
                queryItems: [
                    URLQueryItem(name: "page", value: "1"),
                    URLQueryItem(name: "perPage", value: "10"),
                ]
            )
            jobs = jobResponse?.jobs ?? []
            usage = jobResponse?.usage
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func discoverModels() async {
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
            models = response.models
            noticeMessage = response.cached ? "已显示缓存的模型列表" : "模型列表已更新"
        } catch {
            models = []
            errorMessage = "获取模型列表失败，可手动输入"
        }
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
            noticeMessage = "AI 连接正常，耗时 \(response.latencyMs)ms"
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
        errorMessage = nil
        noticeMessage = nil
        defer { retryingJobID = nil }

        do {
            let _: AiJobRetryResponse = try await client.send(
                AiAPIRoute.retryJob(job.id),
                method: .post,
                body: EmptyRequestBody()
            )
            noticeMessage = "AI 任务已重新排队"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
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

    @State private var model: AiSettingsModel
    @Environment(\.colorScheme) private var colorScheme

    init(repository: AuthRepository) {
        _model = State(initialValue: AiSettingsModel(repository: repository))
    }

    var body: some View {
        Form {
            Section {
                Picker("模型提供商", selection: $model.provider) {
                    ForEach(Self.providers, id: \.0) { provider in
                        Text(provider.1).tag(provider.0)
                    }
                }

                TextField("Base URL", text: $model.baseUrl, prompt: Text("自定义服务时填写 HTTPS 地址"))
                SecureField(
                    "API Key",
                    text: $model.apiKey,
                    prompt: Text(apiKeyPlaceholder)
                )

                TextField("模型", text: $model.model, prompt: Text("选择或手动输入模型名"))

                if !model.models.isEmpty {
                    Picker("已发现模型", selection: $model.model) {
                        Text("手动输入").tag("")
                        ForEach(model.models) { option in
                            Text(option.name ?? option.id).tag(option.id)
                        }
                    }
                }

                Toggle("自动触发", isOn: $model.autoTriggerOnArchive)

                HStack {
                    Button {
                        Task { await model.discoverModels() }
                    } label: {
                        if model.isDiscovering {
                            ProgressView().controlSize(.small)
                        } else {
                            Label("获取模型", systemImage: "arrow.triangle.2.circlepath")
                        }
                    }
                    .disabled(model.isDiscovering || model.isLoading)

                    Spacer()

                    Button("保存配置") {
                        Task { await model.save() }
                    }
                    .disabled(!model.canSave || model.isLoading)

                    Button("测试生成") {
                        Task { await model.test() }
                    }
                    .disabled(model.isTesting || model.isLoading || model.model.isEmpty)

                    Button("删除配置", role: .destructive) {
                        model.isDeleteConfirming = true
                    }
                    .disabled(model.isDeleting || model.isLoading || model.settings == nil)
                }

                if let settings = model.settings {
                    LabeledContent("已配置 Key", value: settings.apiKeyLast4 ?? "已保存")
                    LabeledContent("更新时间", value: settings.updatedAt)
                }
            } header: {
                Text("模型配置")
            } footer: {
                Text("按账号配置模型，归档时按设置触发生成。")
            }

            jobsSection
        }
        .formStyle(.grouped)
        .navigationTitle("AI 模型")
        .task {
            await model.load()
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
    }

    @ViewBuilder
    private var jobsSection: some View {
        Section("最近任务") {
            if let errorMessage = model.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }
            if let noticeMessage = model.noticeMessage {
                Text(noticeMessage)
                    .foregroundStyle(.secondary)
            }

            if let usage = model.usage {
                LabeledContent("任务汇总", value: "共 \(usage.totalJobs) 次")
                LabeledContent("成功 / 失败", value: "\(usage.succeededJobs) / \(usage.failedJobs)")
                LabeledContent("Token", value: "\(usage.totalTokens)")
            }

            ForEach(model.jobs) { job in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("#\(job.id) · 文章 \(job.articleId)")
                            .qiankunjieFont(.labelLarge)
                        Spacer()
                        Text(job.status)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Text(job.model)
                        Spacer()
                        if let totalTokens = job.totalTokens {
                            Text("\(totalTokens) tokens")
                        }
                    }
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(.secondary)

                    if let errorMessage = job.errorMessage, !errorMessage.isEmpty {
                        Text(errorMessage)
                            .qiankunjieFont(.labelMedium)
                            .foregroundStyle(.red)
                    }

                    if job.status == "failed" {
                        Button("重试") {
                            Task { await model.retry(job) }
                        }
                        .disabled(model.retryingJobID == job.id)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var apiKeyPlaceholder: String {
        guard let settings = model.settings, settings.apiKeyConfigured else {
            return "输入 API Key"
        }
        return "已配置 \(settings.apiKeyLast4 ?? "")"
    }
}
