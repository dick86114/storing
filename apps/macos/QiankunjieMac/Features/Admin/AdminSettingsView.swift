import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

@MainActor
@Observable
final class AdminUserManagementModel {
    let client: ManagementAPIClient
    private(set) var users: [AdminUser] = []
    private(set) var isLoading = false
    private(set) var isSaving = false
    var errorMessage: String?
    var noticeMessage: String?
    var isCreating = false
    var editingUser: AdminUser?
    var deletingUser: AdminUser?

    init(repository: AuthRepository) {
        client = ManagementAPIClient(repository: repository)
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AdminUsersResponse = try await client.get("admin/users")
            users = response.users
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func save(
        user: AdminUser?,
        username: String,
        password: String,
        role: String,
        status: String
    ) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let body = AdminUserMutation(
                username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password.nilIfEmpty,
                role: role,
                status: status
            )
            if let user {
                let _: AdminUserResponse = try await client.send(
                    "admin/users/\(user.id)",
                    method: .patch,
                    body: body
                )
                editingUser = nil
                noticeMessage = "用户信息已更新"
            } else {
                let _: AdminUserResponse = try await client.send(
                    "admin/users",
                    method: .post,
                    body: body
                )
                isCreating = false
                noticeMessage = "用户已创建"
            }
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func toggle(_ user: AdminUser) async {
        guard user.role != "admin" else {
            errorMessage = "管理员账号受保护，不能被禁用"
            return
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let body = AdminUserMutation(
                username: nil,
                password: nil,
                role: nil,
                status: user.status == "active" ? "disabled" : "active"
            )
            let _: AdminUserResponse = try await client.send(
                "admin/users/\(user.id)",
                method: .patch,
                body: body
            )
            noticeMessage = user.status == "active" ? "用户已禁用" : "用户已启用"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func delete(_ user: AdminUser) async {
        guard user.role != "admin" else {
            errorMessage = "管理员账号受保护，不能删除"
            return
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        struct DeleteRequest: Encodable, Sendable {
            let confirmUsername: String

            enum CodingKeys: String, CodingKey {
                case confirmUsername = "confirm_username"
            }
        }
        struct DeleteResponse: Decodable, Sendable {
            let deleted: Bool
        }

        do {
            let response: DeleteResponse = try await client.send(
                "admin/users/\(user.id)",
                method: .delete,
                body: DeleteRequest(confirmUsername: user.username)
            )
            guard response.deleted else {
                throw AppError.server
            }
            deletingUser = nil
            noticeMessage = "用户已删除"
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }
}

struct AdminSettingsView: View {
    let repository: AuthRepository
    @State private var selectedTab = AdminSettingsTab.users
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("管理员设置")
                        .font(.system(size: 26, weight: .semibold, design: .serif))
                        .foregroundStyle(WorkspacePalette.primary(for: colorScheme))
                    Text("统一管理系统账号、MCP 连接和平台策略。")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                Picker("", selection: $selectedTab) {
                    ForEach(AdminSettingsTab.allCases) { tab in
                        Label(tab.title, systemImage: tab.systemImage).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .tint(WorkspacePalette.primary(for: colorScheme))
                .frame(width: 360)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(WorkspacePalette.pageBackground(for: colorScheme))

            Divider()

            switch selectedTab {
            case .users:
                AdminUserManagementView(repository: repository)
            case .mcp:
                MCPManagementView(
                    scope: .admin,
                    client: ManagementAPIClient(repository: repository),
                    presentation: .embedded
                )
            }
        }
    }
}

private struct AdminUserManagementView: View {
    @State private var model: AdminUserManagementModel
    @State private var query = ""
    @State private var roleFilter = "all"
    @State private var statusFilter = "all"
    @State private var selectedUserID: AdminUser.ID?

    init(repository: AuthRepository) {
        _model = State(initialValue: AdminUserManagementModel(repository: repository))
    }

    var body: some View {
        Group {
            if model.isLoading && model.users.isEmpty {
                ProgressView("正在加载用户数据…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredUsers.isEmpty {
                ContentUnavailableView(
                    "没有匹配的用户",
                    systemImage: "person.3",
                    description: Text("请调整搜索或筛选条件。")
                )
            } else {
                Table(filteredUsers, selection: $selectedUserID) {
                    TableColumn("用户名") { user in
                        Text(user.username)
                            .fontWeight(user.role == "admin" ? .semibold : .regular)
                    }
                    .width(min: 120, ideal: 180)

                    TableColumn("角色") { user in
                        Text(roleLabel(user.role))
                    }
                    .width(90)

                    TableColumn("状态") { user in
                        Label(
                            user.status == "active" ? "启用" : "禁用",
                            systemImage: user.status == "active" ? "checkmark.circle.fill" : "xmark.circle.fill"
                        )
                        .foregroundStyle(user.status == "active" ? .green : .red)
                    }
                    .width(90)

                    TableColumn("内容") { user in
                        Text("收件箱 \(user.inboxCount) · 归档 \(user.archiveCount) · 收藏 \(user.favoriteCount)")
                            .foregroundStyle(.secondary)
                    }
                    .width(min: 190, ideal: 240)

                    TableColumn("MCP") { user in
                        Text("\(user.activeMCPClientCount)/\(user.mcpClientCount) 个连接 · \(user.mcpRequestCount) 次调用")
                            .foregroundStyle(.secondary)
                    }
                    .width(min: 170, ideal: 220)

                    TableColumn("最后登录") { user in
                        Text(user.lastLoginAt ?? "从未")
                            .foregroundStyle(.secondary)
                    }
                    .width(min: 140, ideal: 180)

                    TableColumn("操作") { user in
                        Menu {
                            Button("编辑用户", systemImage: "pencil") {
                                model.editingUser = user
                            }
                            if user.role != "admin" {
                                Button(
                                    user.status == "active" ? "禁用" : "启用",
                                    systemImage: user.status == "active" ? "pause" : "play"
                                ) {
                                    Task { await model.toggle(user) }
                                }
                                Divider()
                                Button("删除用户", systemImage: "trash", role: .destructive) {
                                    model.deletingUser = user
                                }
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .menuStyle(.borderlessButton)
                    }
                    .width(50)
                }
                .tableStyle(.inset(alternatesRowBackgrounds: true))
            }
        }
        .searchable(text: $query, placement: .toolbar, prompt: "搜索用户名")
        .safeAreaInset(edge: .bottom) {
            HStack {
                Text(summaryText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if let notice = model.noticeMessage {
                    Text(notice)
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 28)
            .background(.bar)
        }
        .toolbar {
            ToolbarItemGroup {
                Menu {
                    Picker("角色", selection: $roleFilter) {
                        Text("全部角色").tag("all")
                        Text("管理员").tag("admin")
                        Text("普通用户").tag("user")
                        Text("服务账号").tag("service")
                    }
                } label: {
                    Label("角色", systemImage: "person.2")
                }

                Menu {
                    Picker("状态", selection: $statusFilter) {
                        Text("全部状态").tag("all")
                        Text("启用").tag("active")
                        Text("禁用").tag("disabled")
                    }
                } label: {
                    Label("状态", systemImage: "line.3.horizontal.decrease.circle")
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
                    Label("新建用户", systemImage: "plus")
                }
                .disabled(model.isSaving)
            }
        }
        .task {
            await model.load()
        }
        .sheet(isPresented: $model.isCreating) {
            AdminUserEditorSheet(model: model, user: nil)
        }
        .sheet(item: $model.editingUser) { user in
            AdminUserEditorSheet(model: model, user: user)
        }
        .sheet(item: $model.deletingUser) { user in
            AdminUserDeleteSheet(model: model, user: user)
        }
        .alert(
            "用户操作失败",
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

    private var filteredUsers: [AdminUser] {
        model.users.filter { user in
            let matchesQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || user.username.localizedCaseInsensitiveContains(query)
            let matchesRole = roleFilter == "all" || user.role == roleFilter
            let matchesStatus = statusFilter == "all" || user.status == statusFilter
            return matchesQuery && matchesRole && matchesStatus
        }
    }

    private var summaryText: String {
        let activeCount = model.users.filter { $0.status == "active" }.count
        let requestCount = model.users.reduce(0) { $0 + $1.mcpRequestCount }
        return "共 \(model.users.count) 个用户 · 启用 \(activeCount) 个 · MCP 调用 \(requestCount) 次"
    }

    private func roleLabel(_ role: String) -> String {
        switch role {
        case "admin": "管理员"
        case "service": "服务账号"
        default: "普通用户"
        }
    }
}

private struct AdminUserEditorSheet: View {
    let model: AdminUserManagementModel
    let user: AdminUser?
    @Environment(\.dismiss) private var dismiss
    @State private var username: String
    @State private var password = ""
    @State private var role: String
    @State private var status: String

    init(model: AdminUserManagementModel, user: AdminUser?) {
        self.model = model
        self.user = user
        _username = State(initialValue: user?.username ?? "")
        _role = State(initialValue: user?.role ?? "user")
        _status = State(initialValue: user?.status ?? "active")
    }

    var body: some View {
        Form {
            Section(user == nil ? "创建用户" : user?.username ?? "编辑用户") {
                TextField("用户名", text: $username)
                SecureField(user == nil ? "初始密码（至少 12 位）" : "重置密码（留空则不修改）", text: $password)
                Picker("账号类型", selection: $role) {
                    Text("普通用户").tag("user")
                    Text("服务账号").tag("service")
                    Text("管理员").tag("admin")
                }
                .disabled(user?.role == "admin")
                Picker("账号状态", selection: $status) {
                    Text("启用").tag("active")
                    Text("禁用").tag("disabled")
                }
                .disabled(user?.role == "admin")
            }

            Section {
                Text(roleDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 480, height: 390)
        .navigationTitle(user == nil ? "新建用户" : "编辑用户")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(model.isSaving ? "保存中…" : "保存") {
                    Task {
                        await model.save(
                            user: user,
                            username: username,
                            password: password,
                            role: role,
                            status: status
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!isValid)
            }
        }
    }

    private var isValid: Bool {
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2, !model.isSaving else {
            return false
        }
        if user == nil, password.count < 12 {
            return false
        }
        if !password.isEmpty, password.count < 12 {
            return false
        }
        return true
    }

    private var roleDescription: String {
        if user?.role == "admin" {
            return "管理员账号受系统保护：不能被禁用或降级，但可以重置密码。"
        }
        switch role {
        case "admin":
            return "可访问系统级管理功能。"
        case "service":
            return "适合 MCP、自动化任务或系统集成。"
        default:
            return "可登录并管理自己的内容和 MCP 连接。"
        }
    }
}

private struct AdminUserDeleteSheet: View {
    let model: AdminUserManagementModel
    let user: AdminUser
    @Environment(\.dismiss) private var dismiss
    @State private var confirmation = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("删除“\(user.username)”", systemImage: "person.crop.circle.badge.minus")
                .font(.title2.weight(.semibold))
            Text("此操作不可撤销，会永久删除该用户的私有资料库和 MCP 连接。")
                .foregroundStyle(.secondary)
            TextField("输入用户名以确认", text: $confirmation)
            HStack {
                Button("取消") { dismiss() }
                Spacer()
                Button(model.isSaving ? "正在删除…" : "确认删除", role: .destructive) {
                    Task { await model.delete(user) }
                }
                .disabled(confirmation != user.username || model.isSaving)
            }
        }
        .padding(24)
        .frame(width: 460)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
