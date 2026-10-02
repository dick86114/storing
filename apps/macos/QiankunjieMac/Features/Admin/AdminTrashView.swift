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

/// 恢复/彻底删除的响应体不参与业务判断：2xx 即成功，404 视为已不在回收站。
struct AdminTrashActionResponse: Decodable, Sendable {}

@MainActor
@Observable
final class AdminTrashModel {
    private(set) var items: [AdminTrashItem] = []
    private(set) var isLoading = false
    private(set) var busyArticleId: Int?
    var errorMessage: String?
    var noticeMessage: String?
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
        } catch {
            if case AppError.contentUnavailable = error {
                items.removeAll { $0.articleId == item.articleId }
                noticeMessage = "「\(item.title ?? "未命名文章")」已从服务器删除。"
                return
            }
            errorMessage = managementErrorMessage(for: error)
        }
    }
}

private struct EmptyBody: Encodable, Sendable {}

struct AdminTrashView: View {
    @State private var model: AdminTrashModel
    @Environment(\.colorScheme) private var colorScheme

    init(client: ManagementAPIClient) {
        _model = State(initialValue: AdminTrashModel(client: client))
    }

    var body: some View {
        Group {
            if model.isLoading {
                ProgressView("正在加载回收站…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.items.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "trash")
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                    Text("回收站是空的")
                        .font(.headline)
                    Text("用户删除的文章会进入这里，可以恢复或彻底删除。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                trashList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .task { await model.load() }
        .refreshable { await model.load() }
        .overlay {
            if let purgeConfirmItem = model.purgeConfirmItem {
                purgeConfirmation(item: purgeConfirmItem)
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
