import AppKit
import Observation
import QiankunjieDesignSystem
import SwiftUI

enum MCPManagementScope: Sendable {
    case personal
    case admin

    var title: String {
        switch self {
        case .personal: "我的 MCP"
        case .admin: "MCP 管理"
        }
    }

    var intro: String {
        switch self {
        case .personal: "申请专属 API Key，把乾坤戒接入你的 AI 工具。"
        case .admin: "管理全部用户连接、平台默认配额与调用记录。"
        }
    }
}

enum MCPManagementTab: String, CaseIterable, Identifiable {
    case connections
    case guide
    case defaults
    case logs

    var id: String { rawValue }

    var title: String {
        switch self {
        case .connections: "连接"
        case .guide: "接入指南"
        case .defaults: "默认配额"
        case .logs: "调用记录"
        }
    }
}

struct MCPRevealedKey: Identifiable {
    let id = UUID()
    let title: String
    let clientName: String
    let apiKey: String
    let scopes: [String]
}

struct MCPScopePreset: Identifiable, Hashable {
    let id: String
    let title: String
    let detail: String
    let scopes: [String]

    static let readonly = Self(
        id: "readonly",
        title: "只读摘要",
        detail: "总结网页内容，不写入收件箱。",
        scopes: ["summary:create", "job:read:self"]
    )

    static let full = Self(
        id: "full",
        title: "摘要与入库",
        detail: "总结网页，并把文章收藏到收件箱。",
        scopes: ["summary:create", "job:read:self", "collect:create", "inbox:write"]
    )

    static let all = [readonly, full]

    static func selected(for scopes: [String]) -> Self {
        let normalized = Set(scopes)
        return normalized == Set(full.scopes) ? .full : .readonly
    }
}

@MainActor
@Observable
final class MCPManagementModel {
    let scope: MCPManagementScope
    let client: ManagementAPIClient

    private(set) var limits: MCPPlatformLimits?
    private(set) var clients: [MCPClient] = []
    private(set) var logs: [MCPRequestLog] = []
    private(set) var users: [AdminUser] = []
    private(set) var isLoading = false
    private(set) var isSaving = false
    var errorMessage: String?
    var noticeMessage: String?
    var revealedKey: MCPRevealedKey?
    var isCreating = false
    var editingClient: MCPClient?

    init(scope: MCPManagementScope, client: ManagementAPIClient) {
        self.scope = scope
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            switch scope {
            case .personal:
                async let limits: MCPPlatformLimits = client.get("mcp/me/limits")
                async let clients: MCPClientsResponse = client.get("mcp/me/clients")
                async let logs: MCPLogsResponse = client.get("mcp/me/request-logs")
                self.limits = try await limits
                self.clients = try await clients.clients
                self.logs = try await logs.logs
            case .admin:
                async let limits: MCPPlatformLimits = client.get("admin/mcp/default-limits")
                async let clients: MCPClientsResponse = client.get("admin/mcp/clients")
                async let logs: MCPLogsResponse = client.get("admin/mcp/request-logs")
                async let users: AdminUsersResponse = client.get("admin/users")
                self.limits = try await limits
                self.clients = try await clients.clients
                self.logs = try await logs.logs
                self.users = try await users.users
            }
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func create(
        name: String,
        scopes: [String],
        saveToInbox: Bool,
        ownerUserID: Int?,
        rateLimitPerMinute: Int?,
        rateLimitPerDay: Int?,
        concurrentCollectLimit: Int?
    ) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let request = MCPCreateRequest(
                name: name,
                ownerUserID: scope == .admin ? ownerUserID : nil,
                scopes: scopes,
                rateLimitPerMinute: scope == .admin ? rateLimitPerMinute : nil,
                rateLimitPerDay: scope == .admin ? rateLimitPerDay : nil,
                concurrentCollectLimit: scope == .admin ? concurrentCollectLimit : nil,
                defaultSaveToInbox: saveToInbox
            )
            let response: MCPKeyResponse = try await client.send(
                scope == .admin ? "admin/mcp/clients" : "mcp/me/clients",
                method: .post,
                body: request
            )
            isCreating = false
            revealedKey = MCPRevealedKey(
                title: "连接已创建",
                clientName: response.client.name,
                apiKey: response.apiKey,
                scopes: response.client.scopes
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func update(
        _ target: MCPClient,
        scopes: [String],
        saveToInbox: Bool,
        rateLimitPerMinute: Int?,
        rateLimitPerDay: Int?,
        concurrentCollectLimit: Int?
    ) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let body = MCPUpdateRequest(
                enabled: nil,
                scopes: scopes,
                rateLimitPerMinute: scope == .admin ? rateLimitPerMinute : nil,
                rateLimitPerDay: scope == .admin ? rateLimitPerDay : nil,
                concurrentCollectLimit: scope == .admin ? concurrentCollectLimit : nil,
                defaultSaveToInbox: saveToInbox
            )
            let _: MCPClientResponse = try await client.send(
                scope == .admin ? "admin/mcp/clients/\(target.id)" : "mcp/me/clients/\(target.id)",
                method: .patch,
                body: body
            )
            editingClient = nil
            noticeMessage = "连接设置已更新"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func toggle(_ target: MCPClient) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let body = MCPUpdateRequest(
                enabled: !target.enabled,
                scopes: nil,
                rateLimitPerMinute: nil,
                rateLimitPerDay: nil,
                concurrentCollectLimit: nil,
                defaultSaveToInbox: nil
            )
            let _: MCPClientResponse = try await client.send(
                scope == .admin ? "admin/mcp/clients/\(target.id)" : "mcp/me/clients/\(target.id)",
                method: .patch,
                body: body
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func rotate(_ target: MCPClient) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let response: MCPKeyResponse = try await client.send(
                scope == .admin ? "admin/mcp/clients/\(target.id)/rotate-key" : "mcp/me/clients/\(target.id)/rotate-key",
                method: .post,
                body: EmptyManagementBody()
            )
            revealedKey = MCPRevealedKey(
                title: "Key 已轮换",
                clientName: target.name,
                apiKey: response.apiKey,
                scopes: target.scopes
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func delete(_ target: MCPClient) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let _: MCPDeleteResponse = try await client.delete(
                scope == .admin ? "admin/mcp/clients/\(target.id)" : "mcp/me/clients/\(target.id)"
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func saveDefaultLimits(_ limits: MCPPlatformLimits) async {
        guard scope == .admin else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let response: MCPPlatformLimits = try await client.send(
                "admin/mcp/default-limits",
                method: .patch,
                body: MCPPlatformLimitsUpdateRequest(
                    rateLimitPerMinute: limits.rateLimitPerMinute,
                    rateLimitPerDay: limits.rateLimitPerDay,
                    concurrentCollectLimit: limits.concurrentCollectLimit
                )
            )
            self.limits = response
            noticeMessage = "平台默认配额已保存"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }
}

private struct EmptyManagementBody: Encodable, Sendable {}

enum MCPManagementPresentation: Sendable {
    case standalone
    case embedded
}

struct MCPManagementView: View {
    @State private var model: MCPManagementModel
    @State private var selectedTab: MCPManagementTab
    let presentation: MCPManagementPresentation
    @Environment(\.colorScheme) private var colorScheme

    init(
        scope: MCPManagementScope,
        client: ManagementAPIClient,
        presentation: MCPManagementPresentation = .standalone
    ) {
        self.presentation = presentation
        _model = State(initialValue: MCPManagementModel(scope: scope, client: client))
        _selectedTab = State(initialValue: .connections)
    }

    var body: some View {
        if presentation == .embedded {
            embeddedAdminContent
                .background(QiankunjieColors.background(for: colorScheme))
                .task { await model.load() }
                .toolbar {
                    ToolbarItemGroup {
                        Button { Task { await model.load() } } label: {
                            Label("刷新", systemImage: "arrow.clockwise")
                        }
                        Button { model.isCreating = true } label: {
                            Label("新建连接", systemImage: "plus")
                        }
                    }
                }
                .sheet(isPresented: $model.isCreating) { MCPCreateSheet(model: model) }
                .sheet(item: $model.editingClient) { client in
                    MCPEditSheet(model: model, client: client)
                }
                .sheet(item: $model.revealedKey) { result in
                    MCPAPIKeySheet(result: result) { model.revealedKey = nil }
                }
                .alert(
                    "MCP 操作失败",
                    isPresented: Binding(
                        get: { model.errorMessage != nil },
                        set: { if !$0 { model.errorMessage = nil } }
                    )
                ) {
                    Button("关闭", role: .cancel) {}
                } message: {
                    Text(model.errorMessage ?? "")
                }
        } else {
        VStack(spacing: 0) {
            header
            Divider()
            Group {
                if model.isLoading && model.clients.isEmpty {
                    ProgressView("正在加载 MCP 数据…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.scope == .personal {
                    personalContent
                } else {
                    tabs
                    Divider()
                    content
                }
            }
        }
        .frame(minWidth: 860, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
        .task {
            await model.load()
        }
        .sheet(isPresented: $model.isCreating) {
            MCPCreateSheet(model: model)
        }
        .sheet(item: $model.editingClient) { client in
            MCPEditSheet(model: model, client: client)
        }
        .sheet(item: $model.revealedKey) { result in
            MCPAPIKeySheet(result: result) {
                model.revealedKey = nil
            }
        }
        .alert(
            "MCP 操作失败",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("关闭", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text(model.scope.title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                Text(model.scope.intro)
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer()

            if let limits = model.limits {
                metric("每分钟", "\(limits.rateLimitPerMinute)", "次")
                metric("每天", "\(limits.rateLimitPerDay)", "次")
                metric("并发", "\(limits.concurrentCollectLimit)", "个")
            }

            Button {
                Task { await model.load() }
            } label: {
                Label("刷新", systemImage: "arrow.clockwise")
            }
            .disabled(model.isLoading)

            Button {
                model.isCreating = true
            } label: {
                Label("新建连接", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.isSaving)
        }
        .padding(20)
    }

    private var tabs: some View {
        HStack {
            Picker("", selection: $selectedTab) {
                ForEach(availableTabs) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: model.scope == .admin ? 360 : 420)

            Spacer()

            if model.scope == .admin {
                Text("管理员可调整连接配额与生命周期")
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private var content: some View {
        ScrollView {
            switch selectedTab {
            case .connections:
                connections
            case .guide:
                guide
            case .defaults:
                defaults
            case .logs:
                logs
            }
        }
    }

    private var personalContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                guide
                sectionTitle("连接")
                personalConnections
                sectionTitle("调用记录")
                personalLogs
            }
            .padding(20)
        }
    }

    private var embeddedAdminContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let limits = model.limits {
                    HStack(spacing: 24) {
                        metric("每分钟", "\(limits.rateLimitPerMinute)", "次")
                        metric("每天", "\(limits.rateLimitPerDay)", "次")
                        metric("并发", "\(limits.concurrentCollectLimit)", "个")
                    }
                }

                sectionTitle("连接")
                adminConnectionTable

                sectionTitle("默认配额")
                MCPDefaultLimitsEditor(limits: model.limits, isSaving: model.isSaving) { limits in
                    Task { await model.saveDefaultLimits(limits) }
                }

                sectionTitle("调用记录")
                adminLogTable
            }
            .padding(20)
        }
    }

    private var adminConnectionTable: some View {
        Group {
            if model.clients.isEmpty {
                ContentUnavailableView("还没有 MCP 连接", systemImage: "point.3.connected.trianglepath.dotted")
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                Table(model.clients) {
                    TableColumn("名称") { client in Text(client.name).fontWeight(.medium) }.width(min: 140, ideal: 180)
                    TableColumn("Owner") { client in
                        Text(client.ownerUsername ?? "用户 #\(client.ownerUserID)").foregroundStyle(.secondary)
                    }.width(min: 120, ideal: 160)
                    TableColumn("状态") { client in
                        Text(client.enabled ? "运行中" : "已暂停")
                            .foregroundStyle(client.enabled ? .green : .orange)
                    }.width(90)
                    TableColumn("配额") { client in
                        Text(limitText(for: client)).foregroundStyle(.secondary)
                    }.width(min: 180, ideal: 220)
                    TableColumn("操作") { client in
                        Menu {
                            Button("编辑权限", systemImage: "pencil") { model.editingClient = client }
                            Button(client.enabled ? "暂停连接" : "恢复连接", systemImage: client.enabled ? "pause" : "play") {
                                Task { await model.toggle(client) }
                            }
                            Button("轮换 API Key", systemImage: "key") { Task { await model.rotate(client) } }
                            Divider()
                            Button("删除连接", systemImage: "trash", role: .destructive) { Task { await model.delete(client) } }
                        } label: { Image(systemName: "ellipsis.circle") }
                        .menuStyle(.borderlessButton)
                    }.width(50)
                }
                .tableStyle(.inset(alternatesRowBackgrounds: true))
                .frame(minHeight: 220)
            }
        }
    }

    private var adminLogTable: some View {
        Group {
            if model.logs.isEmpty {
                ContentUnavailableView("还没有调用记录", systemImage: "list.bullet.rectangle")
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else {
                Table(model.logs) {
                    TableColumn("状态") { log in Text(log.statusLabel).foregroundStyle(log.status == "success" ? .green : .orange) }.width(90)
                    TableColumn("工具") { log in Text(log.toolName).fontWeight(.medium) }.width(min: 150, ideal: 220)
                    TableColumn("结果") { log in Text(log.errorCode ?? "完成").foregroundStyle(.secondary) }.width(min: 120, ideal: 180)
                    TableColumn("耗时") { log in Text(log.durationMS.map { "\($0) ms" } ?? "—").foregroundStyle(.secondary) }.width(90)
                    TableColumn("时间") { log in Text(log.createdAt ?? "—").foregroundStyle(.secondary) }.width(min: 150, ideal: 200)
                }
                .tableStyle(.inset(alternatesRowBackgrounds: true))
                .frame(minHeight: 180)
            }
        }
    }

    private func limitText(for client: MCPClient) -> String {
        let minute = client.rateLimitPerMinute.map(String.init) ?? "不限"
        let day = client.rateLimitPerDay.map(String.init) ?? "不限"
        let concurrent = client.concurrentCollectLimit.map(String.init) ?? "不限"
        return "\(minute)/分钟 · \(day)/天 · 并发 \(concurrent)"
    }

    private var personalConnections: some View {
        Group {
            if model.clients.isEmpty {
                ContentUnavailableView("还没有 MCP 连接", systemImage: "point.3.connected.trianglepath.dotted")
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.clients.enumerated()), id: \.element.id) { index, client in
                        HStack(spacing: 14) {
                            Image(systemName: "key.horizontal.fill")
                                .foregroundStyle(client.enabled ? .green : .orange)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 8) {
                                    Text(client.name).fontWeight(.medium)
                                    Text(client.enabled ? "运行中" : "已暂停")
                                        .font(.caption)
                                        .foregroundStyle(client.enabled ? .green : .orange)
                                }
                                Text(client.scopes.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(client.lastUsedAt ?? "从未")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Menu {
                                Button("编辑权限", systemImage: "pencil") { model.editingClient = client }
                                Button(client.enabled ? "暂停连接" : "恢复连接", systemImage: client.enabled ? "pause" : "play") {
                                    Task { await model.toggle(client) }
                                }
                                Button("轮换 API Key", systemImage: "key") { Task { await model.rotate(client) } }
                                Divider()
                                Button("删除连接", systemImage: "trash", role: .destructive) { Task { await model.delete(client) } }
                            } label: {
                                Image(systemName: "ellipsis.circle")
                            }
                            .menuStyle(.borderlessButton)
                        }
                        .padding(.vertical, 12)
                        if index < model.clients.count - 1 { Divider() }
                    }
                }
            }
        }
    }

    private var personalLogs: some View {
        Group {
            if model.logs.isEmpty {
                ContentUnavailableView("还没有调用记录", systemImage: "list.bullet.rectangle")
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.logs.enumerated()), id: \.element.id) { index, log in
                        HStack(spacing: 12) {
                            Image(systemName: log.status == "success" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(log.status == "success" ? .green : .orange)
                            Text(log.toolName).fontWeight(.medium)
                            Text(log.statusLabel).font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text(log.durationMS.map { "\($0) ms" } ?? "—")
                                .font(.caption).foregroundStyle(.secondary)
                            Text(log.createdAt ?? "—")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 12)
                        if index < model.logs.count - 1 { Divider() }
                    }
                }
            }
        }
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
    }

    private var connections: some View {
        Group {
            if model.clients.isEmpty {
                ContentUnavailableView(
                    "还没有 MCP 连接",
                    systemImage: "point.3.connected.trianglepath.dotted",
                    description: Text("创建连接后，系统会生成只展示一次的专属 API Key。")
                )
            } else {
                List(model.clients) { client in
                    HStack(spacing: 14) {
                        Image(systemName: "key.horizontal.fill")
                            .foregroundStyle(client.enabled ? .green : .orange)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 8) {
                                Text(client.name).fontWeight(.medium)
                                Text(client.enabled ? "运行中" : "已暂停")
                                    .font(.caption)
                                    .foregroundStyle(client.enabled ? .green : .orange)
                            }
                            if model.scope == .admin {
                                Text("Owner：\(client.ownerUsername ?? "用户 #\(client.ownerUserID)")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Text(client.scopes.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Text(client.lastUsedAt ?? "从未")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Menu {
                            Button("编辑权限", systemImage: "pencil") { model.editingClient = client }
                            Button(client.enabled ? "暂停连接" : "恢复连接", systemImage: client.enabled ? "pause" : "play") {
                                Task { await model.toggle(client) }
                            }
                            Button("轮换 API Key", systemImage: "key") { Task { await model.rotate(client) } }
                            Divider()
                            Button("删除连接", systemImage: "trash", role: .destructive) { Task { await model.delete(client) } }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .menuStyle(.borderlessButton)
                        .disabled(model.isSaving)
                    }
                    .padding(.vertical, 3)
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
            }
        }
    }

    @ViewBuilder
    private var defaults: some View {
        if model.scope == .admin {
            MCPDefaultLimitsEditor(
                limits: model.limits,
                isSaving: model.isSaving
            ) { limits in
                Task { await model.saveDefaultLimits(limits) }
            }
            .padding(20)
        } else {
            ContentUnavailableView(
                "平台统一管理配额",
                systemImage: "speedometer",
                description: Text("普通用户不能自行提高调用与并发限额。")
            )
            .padding(.vertical, 70)
        }
    }

    private var logs: some View {
        Group {
            if model.logs.isEmpty {
                ContentUnavailableView(
                    "还没有调用记录",
                    systemImage: "list.bullet.rectangle",
                    description: Text("完成第一次 MCP 调用后，记录会显示在这里。")
                )
            } else {
                List(model.logs) { log in
                    HStack(spacing: 12) {
                        Image(systemName: log.status == "success" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(log.status == "success" ? .green : .orange)

                        Text(log.toolName)
                            .fontWeight(.medium)

                        Text(log.statusLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Text(log.durationMS.map { "\($0) ms" } ?? "—")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(log.createdAt ?? "—")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 3)
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
            }
        }
    }

    private func metric(_ title: String, _ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value)
                    .font(.title3.weight(.semibold))
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .padding(.horizontal, 10)
    }

    private func inlineNotice(_ message: String, isError: Bool) -> some View {
        Text(message)
            .font(.callout)
            .foregroundStyle(isError ? .red : .green)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background((isError ? Color.red : Color.green).opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func logSubtitle(_ log: MCPRequestLog) -> String {
        var parts: [String] = []
        if let transport = log.transport { parts.append(transport) }
        if let duration = log.durationMS { parts.append("\(duration) ms") }
        if let createdAt = log.createdAt { parts.append(createdAt) }
        if let errorCode = log.errorCode { parts.append(errorCode) }
        return parts.joined(separator: " · ")
    }

    private var availableTabs: [MCPManagementTab] {
        model.scope == .admin
            ? [.connections, .defaults, .logs]
            : [.connections, .guide, .logs]
    }

    private var guide: some View {
        MCPGuideView()
    }
}

private enum MCPGuideTransport: String, CaseIterable, Identifiable {
    case remote
    case stdio

    var id: String { rawValue }

    var title: String {
        switch self {
        case .remote: "Streamable HTTP"
        case .stdio: "stdio"
        }
    }

    var detail: String {
        switch self {
        case .remote: "远程 SaaS / 云端 Agent"
        case .stdio: "本地 Codex / Claude Desktop"
        }
    }
}

private struct MCPGuideView: View {
    @State private var transport: MCPGuideTransport = .remote
    @State private var copiedItem: String?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("远程接入")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                    Text("把 Storing 连接到 SaaS 或 Agent")
                        .font(.title2.weight(.semibold))
                    Text("外部 SaaS 默认使用 Streamable HTTP；stdio 仅作为本地客户端兼容方案。")
                        .font(.callout)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }

                HStack(spacing: 10) {
                    transportButton(.remote)
                    transportButton(.stdio)
                }

                switch transport {
                case .remote:
                    remoteGuide
                case .stdio:
                    stdioGuide
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 12) {
                noteCard(
                    icon: "lock.shield",
                    title: "安全提示",
                    text: "API Key 等同于你的 MCP 调用密码。不要提交到 Git，不要发给其他人；怀疑泄露时立即轮换。"
                )
                noteCard(
                    icon: "person.crop.circle",
                    title: "数据归属",
                    text: "远程调用仍然绑定当前用户空间。其他用户无法看到你的收件箱、收藏状态和调用记录。"
                )
                noteCard(
                    icon: "bolt",
                    title: "客户端要求",
                    text: "当前远程认证使用 Bearer API Key。SaaS 客户端需要支持 Streamable HTTP 和自定义 Authorization Header。"
                )
            }
            .frame(width: 240)
        }
        .padding(20)
    }

    private func transportButton(_ option: MCPGuideTransport) -> some View {
        let selected = transport == option
        return Button {
            transport = option
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(option.title)
                        .font(.headline)
                    if option == .remote {
                        Text("推荐")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(WorkspacePalette.primary(for: colorScheme).opacity(0.12), in: Capsule())
                    }
                }
                Text(option.detail)
                    .font(.caption)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                selected ? WorkspacePalette.primary(for: colorScheme).opacity(0.09) : QiankunjieColors.surface(for: colorScheme),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(
                        selected ? WorkspacePalette.primary(for: colorScheme).opacity(0.5) : QiankunjieColors.outline(for: colorScheme)
                    )
            }
        }
        .buttonStyle(.plain)
    }

    private var remoteGuide: some View {
        VStack(alignment: .leading, spacing: 12) {
            callout(
                icon: "checkmark.shield",
                title: "远程方式无需安装 Storing MCP 程序",
                text: "SaaS 客户端直接通过 HTTPS 访问你的 MCP URL，并在 Authorization Header 中携带刚申请的 API Key。"
            )

            stepCard(number: "01", title: "创建专属连接和 API Key") {
                Text("在“我的连接”点击“新建连接”。如果只需要摘要，保留默认的 summary:create 和 job:read:self；需要入库时再开启 collect:create 和 inbox:write。")
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            stepCard(number: "02", title: "填写远程 MCP 地址") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("将下面的 Streamable HTTP endpoint 填入 SaaS 的 Remote MCP URL。")
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    copyRow(
                        text: MCPGuideContent.remoteEndpoint,
                        buttonTitle: copiedItem == "endpoint" ? "已复制" : "复制地址",
                        action: { copy(MCPGuideContent.remoteEndpoint, key: "endpoint") }
                    )
                }
            }

            stepCard(number: "03", title: "配置 Bearer API Key") {
                codeBlock(
                    title: "Streamable HTTP JSON",
                    value: MCPGuideContent.remoteConfiguration(),
                    copyKey: "remote"
                )
            }

            stepCard(number: "04", title: "连接后调用工具") {
                VStack(spacing: 8) {
                    toolRow(name: "summarize_url", detail: "提交公开 URL，返回异步任务 job_id。")
                    toolRow(name: "get_collect_status", detail: "用 job_id 获取标题、摘要、分类和标签。")
                    toolRow(name: "collect_url", detail: "拥有入库权限时，将文章保存到你的收件箱。")
                }
            }
        }
    }

    private var stdioGuide: some View {
        VStack(alignment: .leading, spacing: 12) {
            callout(
                icon: "terminal",
                title: "仅在客户端不支持 Remote MCP URL 时使用",
                text: "stdio 需要在用户电脑安装 Node.js、下载或构建 Storing MCP，并由客户端启动本地进程。"
            )

            stepCard(number: "01", title: "构建本地 MCP 程序") {
                codeBlock(
                    title: "Terminal",
                    value: "cd apps/mcp\npnpm install\npnpm build",
                    copyKey: "build"
                )
            }

            stepCard(number: "02", title: "配置本地 command 和环境变量") {
                codeBlock(
                    title: "stdio JSON",
                    value: MCPGuideContent.stdioConfiguration(),
                    copyKey: "stdio"
                )
            }
        }
    }

    private func stepCard<Content: View>(
        number: String,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.caption.weight(.bold))
                .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                .frame(width: 30, height: 30)
                .background(WorkspacePalette.primary(for: colorScheme).opacity(0.1), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline)
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func callout(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text)
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .padding(14)
        .background(WorkspacePalette.primary(for: colorScheme).opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private func noteCard(icon: String, title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
            Text(title).font(.headline)
            Text(text)
                .font(.callout)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func toolRow(name: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "wrench.and.screwdriver")
                .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(.callout, design: .monospaced).weight(.semibold))
                Text(detail)
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
    }

    private func copyRow(
        text: String,
        buttonTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 10) {
            Text(text)
                .font(.system(.callout, design: .monospaced))
                .textSelection(.enabled)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            Button(buttonTitle, systemImage: "doc.on.doc", action: action)
                .buttonStyle(.bordered)
        }
        .padding(10)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
    }

    private func codeBlock(title: String, value: String, copyKey: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                Spacer()
                Button(copiedItem == copyKey ? "已复制" : "复制配置", systemImage: "doc.on.doc") {
                    copy(value, key: copyKey)
                }
                .buttonStyle(.borderless)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(value)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(10)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private func copy(_ value: String, key: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
        copiedItem = key
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            if copiedItem == key {
                copiedItem = nil
            }
        }
    }
}

private struct MCPClientCard: View {
    let client: MCPClient
    let showsOwner: Bool
    let isBusy: Bool
    let onEdit: () -> Void
    let onToggle: () -> Void
    let onRotate: () -> Void
    let onDelete: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "key.horizontal.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 34, height: 34)
                    .background(QiankunjieColors.accent(for: colorScheme).opacity(0.1), in: RoundedRectangle(cornerRadius: 9))

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(client.name)
                            .font(.headline)
                        Text(client.enabled ? "运行中" : "已暂停")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(client.enabled ? .green : .orange)
                    }
                    if showsOwner {
                        Text("Owner：\(client.ownerUsername ?? "用户 #\(client.ownerUserID)")")
                            .font(.caption)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                    Text("权限：\(client.scopes.joined(separator: " · "))")
                        .font(.caption)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    Text(limitText)
                        .font(.caption)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }

                Spacer()

                Menu {
                    Button("编辑权限") { onEdit() }
                    Button(client.enabled ? "暂停连接" : "恢复连接") { onToggle() }
                    Button("轮换 API Key") { onRotate() }
                    Divider()
                    Button("删除连接", role: .destructive) { onDelete() }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .menuStyle(.borderlessButton)
                .disabled(isBusy)
            }
        }
        .padding(16)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var limitText: String {
        let minute = client.rateLimitPerMinute.map(String.init) ?? "不限"
        let day = client.rateLimitPerDay.map(String.init) ?? "不限"
        let concurrent = client.concurrentCollectLimit.map(String.init) ?? "不限"
        return "每分钟 \(minute) · 每天 \(day) · 并发 \(concurrent)"
    }
}

private struct MCPDefaultLimitsEditor: View {
    let limits: MCPPlatformLimits?
    let isSaving: Bool
    let onSave: (MCPPlatformLimits) -> Void
    @State private var minute = 20
    @State private var day = 500
    @State private var concurrent = 3
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("普通用户默认配额")
                    .font(.title3.weight(.semibold))
                Text("仅影响之后由普通用户自助创建的 MCP 连接，已有连接保留原配额。")
                    .font(.callout)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            HStack(spacing: 18) {
                Stepper("每分钟调用：\(minute)", value: $minute, in: 1...100_000)
                Stepper("每天调用：\(day)", value: $day, in: 1...10_000_000)
                Stepper("并发采集：\(concurrent)", value: $concurrent, in: 1...1_000)
            }

            Button {
                onSave(
                    MCPPlatformLimits(
                        rateLimitPerMinute: minute,
                        rateLimitPerDay: day,
                        concurrentCollectLimit: concurrent
                    )
                )
            } label: {
                Label(isSaving ? "保存中…" : "保存平台默认配额", systemImage: "checkmark")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSaving)
        }
        .padding(20)
        .background(QiankunjieColors.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .onAppear {
            applyLimits()
        }
        .onChange(of: limits) {
            applyLimits()
        }
    }

    private func applyLimits() {
        guard let limits else { return }
        minute = limits.rateLimitPerMinute
        day = limits.rateLimitPerDay
        concurrent = limits.concurrentCollectLimit
    }
}

private struct MCPCreateSheet: View {
    let model: MCPManagementModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var preset = MCPScopePreset.readonly
    @State private var saveToInbox = false
    @State private var ownerUserID: Int?
    @State private var minuteText = "20"
    @State private var dayText = "500"
    @State private var concurrentText = "3"

    var body: some View {
        Form {
            Section("连接信息") {
                TextField("连接名称", text: $name)
                if model.scope == .admin {
                    Picker("Owner 用户", selection: $ownerUserID) {
                        Text("请选择").tag(Int?.none)
                        ForEach(model.users.filter { $0.status == "active" }) { user in
                            Text("\(user.username) · \(user.role)")
                                .tag(Optional(user.id))
                        }
                    }
                }
            }

            Section("权限级别") {
                Picker("权限级别", selection: $preset) {
                    ForEach(MCPScopePreset.all) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.radioGroup)
                Text(preset.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Toggle("采集默认保存到收件箱", isOn: $saveToInbox)
            }

            if model.scope == .admin {
                Section("配额") {
                    TextField("每分钟调用", text: $minuteText)
                    TextField("每天调用", text: $dayText)
                    TextField("并发采集", text: $concurrentText)
                }
            } else if let limits = model.limits {
                Section("平台基础配额") {
                    LabeledContent("每分钟", value: "\(limits.rateLimitPerMinute) 次")
                    LabeledContent("每天", value: "\(limits.rateLimitPerDay) 次")
                    LabeledContent("并发采集", value: "\(limits.concurrentCollectLimit) 个")
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 500, height: model.scope == .admin ? 560 : 480)
        .navigationTitle("新建 MCP 连接")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(model.isSaving ? "创建中…" : "创建") {
                    Task {
                        await model.create(
                            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                            scopes: preset.scopes,
                            saveToInbox: saveToInbox,
                            ownerUserID: ownerUserID,
                            rateLimitPerMinute: positiveInt(minuteText),
                            rateLimitPerDay: positiveInt(dayText),
                            concurrentCollectLimit: positiveInt(concurrentText)
                        )
                    }
                }
                .disabled(!isValid)
            }
        }
        .onAppear {
            ownerUserID = model.users.first(where: { $0.status == "active" })?.id
        }
    }

    private var isValid: Bool {
        guard name.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else {
            return false
        }
        if model.scope == .admin, ownerUserID == nil {
            return false
        }
        return !model.isSaving
    }
}

private struct MCPEditSheet: View {
    let model: MCPManagementModel
    let client: MCPClient
    @Environment(\.dismiss) private var dismiss
    @State private var preset: MCPScopePreset
    @State private var saveToInbox: Bool
    @State private var minuteText: String
    @State private var dayText: String
    @State private var concurrentText: String

    init(model: MCPManagementModel, client: MCPClient) {
        self.model = model
        self.client = client
        _preset = State(initialValue: MCPScopePreset.selected(for: client.scopes))
        _saveToInbox = State(initialValue: client.defaultSaveToInbox)
        _minuteText = State(initialValue: client.rateLimitPerMinute.map(String.init) ?? "20")
        _dayText = State(initialValue: client.rateLimitPerDay.map(String.init) ?? "500")
        _concurrentText = State(initialValue: client.concurrentCollectLimit.map(String.init) ?? "3")
    }

    var body: some View {
        Form {
            Section(client.name) {
                Picker("权限级别", selection: $preset) {
                    ForEach(MCPScopePreset.all) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.radioGroup)
                Toggle("采集默认保存到收件箱", isOn: $saveToInbox)
            }

            if model.scope == .admin {
                Section("配额") {
                    TextField("每分钟调用", text: $minuteText)
                    TextField("每天调用", text: $dayText)
                    TextField("并发采集", text: $concurrentText)
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 480, height: model.scope == .admin ? 430 : 330)
        .navigationTitle("编辑 MCP 连接")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(model.isSaving ? "保存中…" : "保存") {
                    Task {
                        await model.update(
                            client,
                            scopes: preset.scopes,
                            saveToInbox: saveToInbox,
                            rateLimitPerMinute: positiveInt(minuteText),
                            rateLimitPerDay: positiveInt(dayText),
                            concurrentCollectLimit: positiveInt(concurrentText)
                        )
                    }
                }
                .disabled(model.isSaving)
            }
        }
    }
}

private struct MCPAPIKeySheet: View {
    let result: MCPRevealedKey
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label(result.title, systemImage: "key.horizontal.fill")
                .font(.title2.weight(.semibold))
            Text("\(result.clientName) 的 API Key 只显示这一次，请立即保存。")
                .foregroundStyle(.secondary)

            Text(result.apiKey)
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))

            Text("已启用权限：\(result.scopes.joined(separator: " · "))")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack {
                Button("复制 Key") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(result.apiKey, forType: .string)
                }
                Spacer()
                Button("我已保存") {
                    onClose()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 580)
    }
}

private func positiveInt(_ value: String) -> Int? {
    guard let number = Int(value.trimmingCharacters(in: .whitespacesAndNewlines)), number > 0 else {
        return nil
    }
    return number
}

private extension MCPRequestLog {
    var statusLabel: String {
        switch status {
        case "success": "成功"
        case "error": "失败"
        case "rate_limited": "已限流"
        default: status
        }
    }
}
