import Foundation

/// 为 `/wechat/import` 构造 multipart/form-data 请求体。
/// 服务端只认 `files` 字段与可选的 JSON `manifest` 字段。
public enum WeChatMultipartBuilder {
    public struct FilePart: Equatable, Sendable {
        public let filename: String
        public let data: Data
        public let mimeType: String

        public init(filename: String, data: Data, mimeType: String) {
            self.filename = filename
            self.data = data
            self.mimeType = mimeType
        }
    }

    public static func makeBody(
        files: [FilePart],
        manifestJSON: Data,
        boundary: String = "qiankunjie-wechat-\(UUID().uuidString)"
    ) -> (body: Data, contentType: String) {
        var body = Data()

        func append(_ string: String) {
            body.append(Data(string.utf8))
        }

        for file in files {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"files\"; filename=\"\(escape(file.filename))\"\r\n")
            append("Content-Type: \(file.mimeType)\r\n\r\n")
            body.append(file.data)
            append("\r\n")
        }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"manifest\"\r\n")
        append("Content-Type: application/json\r\n\r\n")
        body.append(manifestJSON)
        append("\r\n")
        append("--\(boundary)--\r\n")

        return (body, "multipart/form-data; boundary=\(boundary)")
    }

    /// 微信导出常见类型的 MIME 推断；未知类型按二进制流处理。
    public static func mimeType(forFilename filename: String) -> String {
        switch filename.split(separator: ".").last?.lowercased() {
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "webp": "image/webp"
        case "gif": "image/gif"
        case "avif": "image/avif"
        case "heic": "image/heic"
        case "mp4", "m4v": "video/mp4"
        case "mov": "video/quicktime"
        case "mp3": "audio/mpeg"
        case "m4a": "audio/mp4"
        case "wav": "audio/wav"
        case "txt": "text/plain"
        case "html", "htm": "text/html"
        case "zip": "application/zip"
        default: "application/octet-stream"
        }
    }

    private static func escape(_ filename: String) -> String {
        filename
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
    }
}
