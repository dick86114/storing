import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

struct LibraryBulkRequestTests {
    @Test func 批量动作请求编码服务端契约() throws {
        let body = try JSONEncoder.qiankunjie.encode(BulkActionRequest(action: .favorite, articleIDs: [1, 2]))
        let json = String(decoding: body, as: UTF8.self)

        #expect(json.contains(#""action":"favorite""#))
        #expect(json.contains(#""articleIds":[1,2]"#))
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
