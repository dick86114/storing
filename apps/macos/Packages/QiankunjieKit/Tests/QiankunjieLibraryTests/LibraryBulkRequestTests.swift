import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

struct LibraryBulkRequestTests {
    @Test func 批量动作请求编码服务端契约() throws {
        let body = try JSONEncoder.qiankunjie.encode(BulkActionRequest(action: .favorite, articleIDs: [1, 2], categoryID: nil))
        let json = String(decoding: body, as: UTF8.self)

        #expect(json.contains(#""action":"favorite""#))
        #expect(json.contains(#""articleIds":[1,2]"#))
    }

    @Test func 人工与AI分类请求编码保持兼容() throws {
        let manual = try JSONEncoder.qiankunjie.encode(
            BulkActionRequest(action: .archive, articleIDs: [1, 2], categoryID: 12)
        )
        let manualJSON = String(decoding: manual, as: UTF8.self)
        let ai = try JSONEncoder.qiankunjie.encode(
            BulkAIRequest(articleIDs: [1, 2], includeCategory: true, resetUserCategory: true)
        )
        let aiJSON = String(decoding: ai, as: UTF8.self)

        #expect(manualJSON.contains(#""categoryId":12"#))
        #expect(aiJSON.contains(#""resetUserCategory":true"#))
    }

    @Test func 部分成功响应解码() throws {
        let data = Data(#"""
        {"requestedCount":2,"succeededIds":[1],"skipped":[{"articleId":2,"code":"ALREADY_ARCHIVED"}],"failed":[],"publications":[{"articleId":1,"publicUrl":"/p/a"}]}
        """#.utf8)

        let result = try JSONDecoder.qiankunjie.decode(ArticleBulkActionResult.self, from: data)
        #expect(result.succeededIDs == [1])
        #expect(result.skipped.first?.code == "ALREADY_ARCHIVED")
        #expect(result.publications?.first?.publicURL == "/p/a")
    }
}
