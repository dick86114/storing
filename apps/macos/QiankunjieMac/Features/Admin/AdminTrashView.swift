import Observation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

struct AdminTrashItem: Identifiable, Equatable, Decodable, Sendable {
    let id: String
    let articleId: Int
    let title: String?
    let source: String?
    let author: String?
    let userId: Int
    let username: String?
    let sourceType: String?
    let deletedAt: String?
    let aiSummary: String?
    let contentPreview: String?

    enum CodingKeys: String, CodingKey {
        case articleId
        case title
        case source
        case author
        case userId
        case username
        case sourceType
        case deletedAt
        case aiSummary
        case contentPreview
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articleId = try container.decode(Int.self, forKey: .articleId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        userId = try container.decode(Int.self, forKey: .userId)
        username = try container.decodeIfPresent(String.self, forKey: .username)
        sourceType = try container.decodeIfPresent(String.self, forKey: .sourceType)
        deletedAt = try container.decodeIfPresent(String.self, forKey: .deletedAt)
        aiSummary = try container.decodeIfPresent(String.self, forKey: .aiSummary)
        contentPreview = try container.decodeIfPresent(String.self, forKey: .contentPreview)
        id = "\(articleId)-\(userId)"
    }
}

struct AdminTrashResponse: Decodable, Sendable {
    let items: [AdminTrashItem]
    let total: Int
}

struct AdminTrashOrphanItem: Identifiable, Equatable, Decodable, Sendable {
    let id: Int
    let title: String?
    let source: String?
    let author: String?
    let sourceType: String?
    let createdAt: String?
    let contentPreview: String?

    enum CodingKeys: String, CodingKey {
        // 解码统一走 JSONDecoder.qiankunjie（keyDecodingStrategy = .convertFromSnakeCase），
        // 服务端的 article_id 会先被转成 articleId 再匹配，这里必须写转换后的驼峰名；
        // 写成原始蛇形名会直接抛 keyNotFound，导致整个孤儿响应解码失败、列表恒为空。
        case articleId
        case title
        case source
        case author
        case sourceType
        case createdAt
        case contentPreview
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .articleId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        sourceType = try container.decodeIfPresent(String.self, forKey: .sourceType)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        contentPreview = try container.decodeIfPresent(String.self, forKey: .contentPreview)
    }
}

struct AdminTrashOrphansResponse: Decodable, Sendable {
    let items: [AdminTrashOrphanItem]
    let total: Int
}

/// 恢复/彻底删除的响应体不参与业务判断：2xx 即成功，404 视为已不在回收站。
struct AdminTrashActionResponse: Decodable, Sendable {}

struct AdminTrashBulkFailure: Decodable, Equatable, Sendable {
    let articleId: Int
    let userId: Int?
    let title: String?
    let reason: String

    enum CodingKeys: String, CodingKey {
        case articleId
        case userId
        case title
        case reason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articleId = try container.decode(Int.self, forKey: .articleId)
        userId = try container.decodeIfPresent(Int.self, forKey: .userId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        reason = try container.decode(String.self, forKey: .reason)
    }

    init(articleId: Int, userId: Int? = nil, title: String?, reason: String) {
        self.articleId = articleId
        self.userId = userId
        self.title = title
        self.reason = reason
    }
}

struct AdminTrashBulkResult: Decodable, Equatable, Sendable {
    let scope: String
    let attempted: Int
    let succeeded: Int
    let failed: Int
    let deletedMetadata: Int
    let deletedArticles: Int
    let failures: [AdminTrashBulkFailure]

    enum CodingKeys: String, CodingKey {
        case scope
        case attempted
        case succeeded
        case failed
        case deletedMetadata
        case deletedArticles
        case failures
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        scope = try container.decode(String.self, forKey: .scope)
        attempted = try container.decode(Int.self, forKey: .attempted)
        succeeded = try container.decode(Int.self, forKey: .succeeded)
        failed = try container.decode(Int.self, forKey: .failed)
        deletedMetadata = try container.decode(Int.self, forKey: .deletedMetadata)
        deletedArticles = try container.decode(Int.self, forKey: .deletedArticles)
        failures = try container.decodeIfPresent([AdminTrashBulkFailure].self, forKey: .failures) ?? []
    }
}

enum AdminTrashBulkPresentation {
    static func headline(scope: String, succeeded: Int, failed: Int) -> String {
        let scopeName = scope == "orphans" ? "孤儿文章" : "已删除文章"
        return "\(scopeName)清空完成：成功 \(succeeded) 条，失败 \(failed) 条"
    }

    static func summary(deletedArticles: Int) -> String {
        "物理删除全局文章 \(deletedArticles) 篇。"
    }

    static func failureText(_ failure: AdminTrashBulkFailure) -> String {
        let userText = failure.userId.map { "，用户 #\($0)" } ?? ""
        let title = failure.title ?? "#\(failure.articleId)"
        return "\(title)（#\(failure.articleId)\(userText)）：\(failure.reason)"
    }
}

@MainActor
@Observable
final class AdminTrashModel {
    private(set) var items: [AdminTrashItem] = []
    private(set) var orphanItems: [AdminTrashOrphanItem] = []
    private(set) var isLoading = false
    private(set) var busyArticleId: Int?
    private(set) var isBulkClearing = false
    var errorMessage: String?
    var noticeMessage: String?
    var bulkResult: AdminTrashBulkResult?
    var purgeConfirmItem: AdminTrashItem?
    var detailItem: AdminTrashItem?

    private let client: ManagementAPIClient

    init(client: ManagementAPIClient) {
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AdminTrashResponse = try await client.get("admin/trash")
            items = response.items
            let orphans: AdminTrashOrphansResponse = try await client.get("admin/trash/orphans")
            orphanItems = orphans.items
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func adopt(_ orphan: AdminTrashOrphanItem) async {
        busyArticleId = orphan.id
        defer { busyArticleId = nil }
        do {
            let _: AdminTrashActionResponse = try await client.send(
                "admin/trash/\(orphan.id)/adopt",
                method: .post,
                body: EmptyBody()
            )
            orphanItems.removeAll { $0.id == orphan.id }
            noticeMessage = "「\(orphan.title ?? "未命名文章")」已领养到你的资料库。"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func purgeOrphan(_ orphan: AdminTrashOrphanItem) async {
        busyArticleId = orphan.id
        defer { busyArticleId = nil }
        do {
            let _: AdminTrashActionResponse = try await client.delete("admin/trash/\(orphan.id)")
            orphanItems.removeAll { $0.id == orphan.id }
            noticeMessage = "「\(orphan.title ?? "未命名文章")」已从服务器彻底删除。"
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func restore(_ item: AdminTrashItem) async {
        busyArticleId = item.articleId
        defer { busyArticleId = nil }
        do {
            let _: AdminTrashActionResponse = try await client.send(
                "admin/trash/\(item.articleId)/restore",
                method: .post,
                body: EmptyBody()
            )
            items.removeAll { $0.articleId == item.articleId }
            noticeMessage = "「\(item.title ?? "未命名文章")」已恢复到原用户的资料库。"
            await load()
        } catch let error as AppError {
            // 404：可能已恢复过或已不在回收站，按已处理收尾。
            if case .contentUnavailable = error {
                items.removeAll { $0.articleId == item.articleId }
                noticeMessage = "「\(item.title ?? "未命名文章")」已在资料库中。"
            } else {
                errorMessage = managementErrorMessage(for: error)
            }
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func purge(_ item: AdminTrashItem) async {
        busyArticleId = item.articleId
        defer { busyArticleId = nil }
        do {
            let _: AdminTrashActionResponse = try await client.delete("admin/trash/\(item.articleId)")
            // 404 说明第一次点击已删除成功；按"已删除"收尾，避免误报服务不可用。
            items.removeAll { $0.articleId == item.articleId }
            noticeMessage = "「\(item.title ?? "未命名文章")」已从服务器彻底删除。"
            await load()
        } catch {
            if case AppError.contentUnavailable = error {
                items.removeAll { $0.articleId == item.articleId }
                noticeMessage = "「\(item.title ?? "未命名文章")」已从服务器删除。"
                return
            }
            errorMessage = managementErrorMessage(for: error)
        }
    }

    func clearDeleted() async {
        await clear(scope: "deleted") {
            try await self.client.delete("admin/trash") as AdminTrashBulkResult
        }
    }

    func clearOrphans() async {
        await clear(scope: "orphans") {
            try await self.client.delete("admin/trash/orphans") as AdminTrashBulkResult
        }
    }

    private func clear(scope: String, operation: () async throws -> AdminTrashBulkResult) async {
        isBulkClearing = true
        defer { isBulkClearing = false }
        do {
            let result = try await operation()
            bulkResult = result
            noticeMessage = AdminTrashBulkPresentation.headline(
                scope: result.scope,
                succeeded: result.succeeded,
                failed: result.failed
            )
            await load()
        } catch {
            errorMessage = managementErrorMessage(for: error)
        }
    }
}

private struct EmptyBody: Encodable, Sendable {}

struct AdminTrashView: View {
    @State private var model: AdminTrashModel
    @Environment(\.colorScheme) private var colorScheme
    @State private var showsOrphans = false
    @State private var detailOrphan: AdminTrashOrphanItem?
    @State private var purgeOrphanTarget: AdminTrashOrphanItem?
    @State private var confirmClearDeleted = false
    @State private var confirmClearOrphans = false

    init(client: ManagementAPIClient) {
        _model = State(initialValue: AdminTrashModel(client: client))
    }

    var body: some View {
        Group {
            if model.isLoading {
                ProgressView("正在加载回收站…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if showsOrphans ? model.orphanItems.isEmpty : model.items.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "trash")
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                    Text(showsOrphans ? "没有孤儿文章" : "回收站是空的")
                        .font(.headline)
                    Text("用户删除的文章会进入这里，可以恢复或彻底删除。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                showsOrphans ? AnyView(orphanList) : AnyView(trashList)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .task { await model.load() }
        .refreshable { await model.load() }
        .safeAreaInset(edge: .top) {
            Picker("视图", selection: $showsOrphans) {
                Text("已删除").tag(false)
                Text("孤儿文章").tag(true)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .overlay {
            if let purgeConfirmItem = model.purgeConfirmItem {
                purgeConfirmation(item: purgeConfirmItem)
            }
            if let purgeOrphanTarget = purgeOrphanTarget {
                purgeOrphanConfirmation(orphan: purgeOrphanTarget)
            }
            if confirmClearDeleted {
                bulkClearConfirmation(
                    title: "确认清空已删除文章",
                    message: "将处理 \(model.items.count) 条已删除记录。仍被其他用户保留的文章只清除删除记录；没有任何保留者的文章会物理删除全局内容。",
                    cancel: { confirmClearDeleted = false }
                ) {
                    confirmClearDeleted = false
                    Task { await model.clearDeleted() }
                }
            }
            if confirmClearOrphans {
                bulkClearConfirmation(
                    title: "确认清空孤儿文章",
                    message: "将处理 \(model.orphanItems.count) 篇孤儿文章。这些文章没有任何用户记录，原始内容会从服务器物理删除。",
                    cancel: { confirmClearOrphans = false }
                ) {
                    confirmClearOrphans = false
                    Task { await model.clearOrphans() }
                }
            }
            if let bulkResult = model.bulkResult {
                bulkResultView(bulkResult)
            }
        }
        .overlay {
            if let detailItem = model.detailItem {
                detailSheet(item: detailItem)
            }
        }
    }

    private var trashList: some View {
        List {
            Section {
                HStack {
                    Text("共 \(model.items.count) 条")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button {
                        Task { await model.load() }
                    } label: {
                        Label("刷新", systemImage: "arrow.clockwise")
                    }
                    Button("清空已删除", role: .destructive) {
                        confirmClearDeleted = true
                    }
                    .disabled(model.items.isEmpty || model.isBulkClearing)
                }
            }
            Section {
                ForEach(model.items) { item in
                    row(item)
                }
            } footer: {
                Text("恢复会把文章放回原用户的资料库；彻底删除会从服务器清除正文与元数据，无法恢复。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .overlay(alignment: .bottom) {
            VStack(spacing: 6) {
                if let notice = model.noticeMessage {
                    Text(notice)
                        .font(.footnote)
                        .foregroundStyle(.green)
                }
                if let error = model.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .padding(.bottom, 12)
        }
    }

    private var orphanList: some View {
        List {
            Section {
                HStack {
                    Text("共 \(model.orphanItems.count) 条")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button {
                        Task { await model.load() }
                    } label: {
                        Label("刷新", systemImage: "arrow.clockwise")
                    }
                    Button("清空孤儿文章", role: .destructive) {
                        confirmClearOrphans = true
                    }
                    .disabled(model.orphanItems.isEmpty || model.isBulkClearing)
                }
            }
            Section {
                ForEach(model.orphanItems) { orphan in
                    orphanRow(orphan)
                }
            } footer: {
                Text("孤儿文章是导入时元数据写入失败的记录，所有端都不可见。领养后会进入你的资料库并正常显示。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func orphanRow(_ orphan: AdminTrashOrphanItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(orphan.title ?? "未命名文章")
                    .font(.headline)
                Text(
                    [
                        orphan.source ?? "乾坤戒",
                        orphan.author,
                        "创建于 \(orphan.createdAt ?? "—")",
                    ]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 8) {
                Button("详情") {
                    detailOrphan = orphan
                }
                .buttonStyle(.bordered)

                Button("领养") {
                    Task { await model.adopt(orphan) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.busyArticleId != nil)

                Button("彻底删除", role: .destructive) {
                    purgeOrphanTarget = orphan
                }
                .buttonStyle(.bordered)
                .disabled(model.busyArticleId != nil)
            }
        }
        .padding(.vertical, 4)
    }

    private func row(_ item: AdminTrashItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title ?? "未命名文章")
                    .font(.headline)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    Text(item.source ?? "乾坤戒")
                    Text(item.username.map { "用户：\($0)" } ?? "用户 #\(item.userId)")
                    if let deletedAt = item.deletedAt {
                        Text("删除于 \(deletedAt)")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 8) {
                Button("详情") {
                    model.detailItem = item
                }
                .buttonStyle(.bordered)
                .disabled(model.busyArticleId != nil)

                Button("恢复") {
                    Task { await model.restore(item) }
                }
                .buttonStyle(.bordered)
                .disabled(model.busyArticleId != nil)

                Button("彻底删除", role: .destructive) {
                    model.purgeConfirmItem = item
                }
                .buttonStyle(.bordered)
                .disabled(model.busyArticleId != nil)
            }
        }
        .padding(.vertical, 4)
    }

    private func bulkClearConfirmation(
        title: String,
        message: String,
        cancel: @escaping () -> Void,
        action: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 30))
                .foregroundStyle(.orange)
            Text(title)
                .font(.headline)
            Text("\(message) 操作无法恢复，完成后会展示成功、失败和失败原因。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("取消", action: cancel)
                    .keyboardShortcut(.cancelAction)
                Button("确认清空", role: .destructive, action: action)
                    .keyboardShortcut(.defaultAction)
                    .disabled(model.isBulkClearing)
            }
        }
        .padding(24)
        .frame(maxWidth: 420)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(radius: 18)
        }
        .padding(40)
    }

    private func bulkResultView(_ result: AdminTrashBulkResult) -> some View {
        VStack(spacing: 14) {
            Image(systemName: result.failed > 0 ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .font(.system(size: 30))
                .foregroundStyle(result.failed > 0 ? Color.orange : Color.green)
            Text("清空结果")
                .font(.headline)
            Text(AdminTrashBulkPresentation.headline(
                scope: result.scope,
                succeeded: result.succeeded,
                failed: result.failed
            ))
            Text(AdminTrashBulkPresentation.summary(deletedArticles: result.deletedArticles))
                .font(.footnote)
                .foregroundStyle(.secondary)
            if !result.failures.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(result.failures.enumerated()), id: \.offset) { _, failure in
                            Text(AdminTrashBulkPresentation.failureText(failure))
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 180)
            }
            Button("知道了") {
                model.bulkResult = nil
            }
                .keyboardShortcut(.defaultAction)
        }
        .padding(24)
        .frame(maxWidth: 460)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(radius: 18)
        }
        .padding(40)
    }

    private func purgeConfirmation(item: AdminTrashItem) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 30))
                .foregroundStyle(.orange)
            Text("彻底删除「\(item.title ?? "未命名文章")」？")
                .font(.headline)
            Text("正文、媒体引用和所有用户的记录都会从服务器清除，此操作无法恢复。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("取消") {
                    model.purgeConfirmItem = nil
                }
                .keyboardShortcut(.cancelAction)
                Button("彻底删除", role: .destructive) {
                    model.purgeConfirmItem = nil
                    Task { await model.purge(item) }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(model.busyArticleId != nil)
            }
        }
        .padding(24)
        .frame(maxWidth: 380)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(radius: 18)
        }
        .padding(40)
    }

    private func purgeOrphanConfirmation(orphan: AdminTrashOrphanItem) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 30))
                .foregroundStyle(.orange)
            Text("彻底删除「\(orphan.title ?? "未命名文章")」？")
                .font(.headline)
            Text("这篇孤儿文章没有任何用户元数据，删除后原始内容将从服务器清除，无法恢复。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 10) {
                Button("取消") {
                    purgeOrphanTarget = nil
                }
                .keyboardShortcut(.cancelAction)
                Button("彻底删除", role: .destructive) {
                    Task { await model.purgeOrphan(orphan) }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(model.busyArticleId != nil)
            }
        }
        .padding(24)
        .frame(maxWidth: 380)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(color: .black.opacity(0.18), radius: 18)
        }
        .padding(40)
    }

    private func detailSheet(item: AdminTrashItem) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title ?? "未命名文章")
                    .font(.headline)
                Text(
                    [
                        item.source ?? "乾坤戒",
                        item.author,
                        "用户：\(item.username ?? "#\(item.userId)")",
                        "删除于 \(item.deletedAt ?? "—")",
                    ]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if let summary = item.aiSummary, !summary.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("AI 摘要")
                        .font(.subheadline.weight(.semibold))
                    Text(summary)
                        .font(.callout)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("正文预览")
                    .font(.subheadline.weight(.semibold))
                ScrollView {
                    Text(item.contentPreview?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? item.contentPreview! : "（无正文）")
                        .font(.system(.callout, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
                .frame(maxHeight: 280)
            }

            HStack {
                Spacer()
                Button("关闭") {
                    model.detailItem = nil
                }
                .keyboardShortcut(.cancelAction)
            }
        }
        .padding(24)
        .frame(width: 560, height: 480)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(QiankunjieColors.surface(for: colorScheme))
                .shadow(color: .black.opacity(0.25), radius: 24)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .padding(30)
    }
}
