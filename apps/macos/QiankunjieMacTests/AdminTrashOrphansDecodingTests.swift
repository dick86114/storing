import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct AdminTrashOrphansDecodingTests {
    /// 接口返回的是服务端蛇形字段（article_id / created_at / …），
    /// 解码统一走 JSONDecoder.qiankunjie（.convertFromSnakeCase）。
    /// 这里锁死契约：一旦 CodingKey 写回原始蛇形名，解码会抛 keyNotFound，
    /// 管理员在 mac 端的孤儿文章列表就会恒为 0 条。
    private let payload = Data(#"""
    {
      "items": [
        {
          "article_id": 301,
          "title": "Google",
          "source": "google.com",
          "author": null,
          "cover_image": "https://www.google.com/logo.png",
          "source_type": null,
          "created_at": "2026-08-04T11:48:48.133Z",
          "updated_at": "2026-08-04T11:48:48.133Z",
          "content_preview": ".L3eUgb{display:flex}"
        }
      ],
      "total": 1
    }
    """#.utf8)

    @Test func 孤儿文章响应按驼峰键解码成功() throws {
        let response = try JSONDecoder.qiankunjie.decode(AdminTrashOrphansResponse.self, from: payload)

        #expect(response.total == 1)
        #expect(response.items.count == 1)
    }

    @Test func 孤儿文章字段映射到对应属性() throws {
        let response = try JSONDecoder.qiankunjie.decode(AdminTrashOrphansResponse.self, from: payload)
        let orphan = try #require(response.items.first)

        #expect(orphan.id == 301)
        #expect(orphan.title == "Google")
        #expect(orphan.source == "google.com")
        #expect(orphan.author == nil)
        #expect(orphan.sourceType == nil)
        #expect(orphan.createdAt == "2026-08-04T11:48:48.133Z")
        #expect(orphan.contentPreview == ".L3eUgb{display:flex}")
    }

    @Test func 孤儿文章列表为空时不报错() throws {
        let empty = Data(#"{"items":[],"total":0}"#.utf8)

        let response = try JSONDecoder.qiankunjie.decode(AdminTrashOrphansResponse.self, from: empty)

        #expect(response.items.isEmpty)
        #expect(response.total == 0)
    }
}
