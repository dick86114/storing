import Foundation
import Testing
import QiankunjieWeChat

struct WeChatMultipartBuilderTests {
    @Test("multipart 请求体包含文件与 manifest 字段")
    func buildsMultipartBody() throws {
        let manifest = Data(#"{"source":"macos"}"#.utf8)
        let (body, contentType) = WeChatMultipartBuilder.makeBody(
            files: [
                WeChatMultipartBuilder.FilePart(
                    filename: "聊天记录.zip",
                    data: Data([0x50, 0x4b]),
                    mimeType: "application/zip"
                ),
            ],
            manifestJSON: manifest,
            boundary: "test-boundary"
        )

        let text = String(decoding: body, as: UTF8.self)
        #expect(contentType == "multipart/form-data; boundary=test-boundary")
        #expect(text.contains("Content-Disposition: form-data; name=\"files\"; filename=\"聊天记录.zip\""))
        #expect(text.contains("Content-Type: application/zip"))
        #expect(text.contains("Content-Disposition: form-data; name=\"manifest\""))
        #expect(text.hasSuffix("--test-boundary--\r\n"))
        #expect(text.contains(#"{"source":"macos"}"#))
    }

    @Test("文件名中的引号与换行会被转义")
    func escapesHeaderRisks() {
        let (body, _) = WeChatMultipartBuilder.makeBody(
            files: [
                WeChatMultipartBuilder.FilePart(
                    filename: "bad\"name\r\n.zip",
                    data: Data(),
                    mimeType: "application/zip"
                ),
            ],
            manifestJSON: Data("{}".utf8),
            boundary: "b"
        )
        let text = String(decoding: body, as: UTF8.self)
        #expect(!text.contains("bad\"name\r\n.zip"))
    }

    @Test("常见媒体扩展名映射到正确 MIME")
    func mapsMediaMimeTypes() {
        #expect(WeChatMultipartBuilder.mimeType(forFilename: "photo.JPG") == "image/jpeg")
        #expect(WeChatMultipartBuilder.mimeType(forFilename: "video.mov") == "video/quicktime")
        #expect(WeChatMultipartBuilder.mimeType(forFilename: "record.m4a") == "audio/mp4")
        #expect(WeChatMultipartBuilder.mimeType(forFilename: "unknown.bin") == "application/octet-stream")
    }
}
