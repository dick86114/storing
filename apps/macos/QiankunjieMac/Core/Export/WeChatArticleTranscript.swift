import Foundation

/// 微信聊天记录阅读器 HTML 的导出专用转换器。
/// 服务端新版 HTML 已把媒体放进消息体；旧数据也只要还有这份 HTML 就能按时间线重排。
enum WeChatArticleTranscript {
    static func isTranscript(_ html: String?) -> Bool {
        html?.contains("wechat-chat") == true
    }

    static func markdown(from html: String) -> String? {
        guard isTranscript(html) else { return nil }
        return render(html) { sender, time, paragraphs in
            var blocks = ["**\(sender)** · \(time)"]
            blocks.append(contentsOf: paragraphs)
            blocks.append("---")
            return blocks
        }
    }

    static func plainText(from html: String) -> String? {
        guard isTranscript(html) else { return nil }
        return render(html) { sender, time, paragraphs in
            ["\(sender) · \(time)"] + paragraphs.map(plainTextParagraph)
        }
    }

    private static func plainTextParagraph(_ paragraph: String) -> String {
        let pattern = #"^!\[([^\]]*)\]\(([^)]+)\)$"#
        guard
            let regex = try? NSRegularExpression(pattern: pattern),
            let match = regex.firstMatch(
                in: paragraph,
                range: NSRange(paragraph.startIndex..., in: paragraph)
            ),
            let altRange = Range(match.range(at: 1), in: paragraph),
            let urlRange = Range(match.range(at: 2), in: paragraph)
        else {
            return paragraph
        }

        let alt = String(paragraph[altRange])
        let url = String(paragraph[urlRange])
        return "[图片：\(alt.isEmpty ? "未命名" : alt)] \(url)"
    }

    private static func render(
        _ html: String,
        messageRenderer: (_ sender: String, _ time: String, _ paragraphs: [String]) -> [String]
    ) -> String? {
        let messages = matches(of: #"<div class="wechat-msg">(.*?)</div>\s*</div>"#, in: html)
        guard !messages.isEmpty else { return nil }

        var lines: [String] = []
        if let title = capturedText(#"<p class="wechat-chat-title">(.*?)</p>"#, in: html) {
            lines.append("### \(title)")
        }
        if let date = capturedText(#"<p class="wechat-chat-date">(.*?)</p>"#, in: html) {
            lines.append(date)
        }

        for message in messages {
            guard
                let sender = capturedText(#"<span class="wechat-msg-sender">(.*?)</span>"#, in: message),
                let time = capturedText(#"<span class="wechat-msg-time">(.*?)</span>"#, in: message)
            else {
                continue
            }

            if !lines.isEmpty {
                lines.append("")
            }
            lines.append(contentsOf: messageRenderer(sender, time, bodyParagraphs(message)))
        }

        return lines
            .joined(separator: "\n")
            .replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func bodyParagraphs(_ message: String) -> [String] {
        guard
            let body = capturedText(
                #"<div class="wechat-msg-body">(.*)$"#,
                in: message
            )
        else {
            return []
        }

        let paragraphs = matches(of: #"<p\b[^>]*>(.*?)</p>"#, in: body).map { paragraph -> String in
            let html = String(paragraph)
            if html.contains("<img") {
                return imageParagraph(from: html)
            }
            return plainInlineText(html)
        }
        return paragraphs.filter { !$0.isEmpty }
    }

    private static func imageParagraph(from paragraph: String) -> String {
        guard let imageTag = matches(of: #"<img\b[^>]*>"#, in: paragraph).first else {
            return plainInlineText(paragraph)
        }

        let source = attribute("src", in: imageTag) ?? ""
        guard !source.isEmpty else { return plainInlineText(paragraph) }
        let alt = attribute("alt", in: imageTag) ?? ""
        return "![\(alt.isEmpty ? "图片" : alt)](\(source))"
    }

    private static func plainInlineText(_ html: String) -> String {
        decodeEntities(
            html
                .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    private static func attribute(_ name: String, in tag: String) -> String? {
        capturedText(
            #"\b\#(NSRegularExpression.escapedPattern(for: name))\s*=\s*["']([^"']+)["']"#,
            in: tag
        ).map(decodeEntities)
    }

    private static func capturedText(_ pattern: String, in text: String) -> String? {
        matches(of: pattern, in: text).first
    }

    private static func matches(of pattern: String, in text: String) -> [String] {
        guard let regex = try? NSRegularExpression(
            pattern: pattern,
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) else {
            return []
        }

        let range = NSRange(text.startIndex..., in: text)
        return regex.matches(in: text, range: range).compactMap { match in
            match.numberOfRanges > 1
                ? Range(match.range(at: 1), in: text).map { String(text[$0]) }
                : Range(match.range, in: text).map { String(text[$0]) }
        }
    }

    private static func decodeEntities(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}
