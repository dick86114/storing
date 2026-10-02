import Foundation
import QiankunjieCore
import QiankunjieNetworking

public struct WeChatImportResult: Equatable, Sendable {
    public let articleId: Int
    public let title: String
    public let messageCount: Int
    public let mediaCount: Int
    public let uploadedMediaCount: Int

    init(
        articleId: Int,
        title: String,
        messageCount: Int,
        mediaCount: Int,
        uploadedMediaCount: Int
    ) {
        self.articleId = articleId
        self.title = title
        self.messageCount = messageCount
        self.mediaCount = mediaCount
        self.uploadedMediaCount = uploadedMediaCount
    }
}

struct WeChatImportEnvelope: Decodable, Sendable {
    let imported: WeChatImportResultWire

    enum CodingKeys: String, CodingKey {
        case imported = "import"
    }
}

struct WeChatImportResultWire: Decodable, Sendable {
    let articleId: Int
    let title: String
    let messageCount: Int
    let mediaCount: Int
    let uploadedMediaCount: Int
}

/// 上传一个批次到服务端；解析、媒体上图床、入库与 AI 全部由服务端完成。
public struct WeChatImportRepository: Sendable {
    private let apiClient: APIClient

    public init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    public func importFiles(_ files: [WeChatMultipartBuilder.FilePart]) async throws -> WeChatImportResult {
        let manifest = try JSONEncoder().encode(["source": "macos"] as [String: String])
        let multipart = WeChatMultipartBuilder.makeBody(files: files, manifestJSON: manifest)
        let request = APIRequest(
            method: .post,
            path: "wechat/import",
            headers: ["Content-Type": multipart.contentType],
            body: multipart.body
        )
        let envelope: WeChatImportEnvelope = try await apiClient.send(request, authenticated: true)
        let wire = envelope.imported
        return WeChatImportResult(
            articleId: wire.articleId,
            title: wire.title,
            messageCount: wire.messageCount,
            mediaCount: wire.mediaCount,
            uploadedMediaCount: wire.uploadedMediaCount
        )
    }
}
