import Foundation

/// 一次微信转发在 Inbox 中的批次描述。
/// Extension 写入后主应用据此读取文件，重试与诊断也依赖它。
public struct WeChatBatchManifest: Codable, Equatable, Sendable {
    public struct Item: Codable, Equatable, Sendable {
        public let id: UUID
        public let filename: String
        public let byteCount: Int64

        public init(id: UUID = UUID(), filename: String, byteCount: Int64) {
            self.id = id
            self.filename = filename
            self.byteCount = byteCount
        }
    }

    public let batchID: UUID
    public let createdAt: Date
    public let items: [Item]

    public init(batchID: UUID = UUID(), createdAt: Date = Date(), items: [Item]) {
        self.batchID = batchID
        self.createdAt = createdAt
        self.items = items
    }

    public static let filename = "manifest.json"

    public func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }

    public static func decode(_ data: Data) throws -> WeChatBatchManifest {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(WeChatBatchManifest.self, from: data)
    }
}
