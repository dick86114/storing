import Foundation

struct HTMLArticleRenderer: Sendable {
    func render(_ document: ArticleExportDocument) -> String {
        let body = document.contentHTML?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? markdownHTML(document.preferredMarkdown)
        let summary = document.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines)
        let metadata = metadata(document)

        return """
        <!doctype html>
        <html lang="zh-CN">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>\(escape(document.title))</title>
          <style>
            body { max-width: 760px; margin: 0 auto; padding: 48px 24px; font: 17px/1.75 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; color: #18251d; background: #f6f8f6; }
            h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 12px; }
            .meta { color: #607064; font-size: .9rem; margin-bottom: 28px; }
            blockquote { margin: 24px 0; padding: 12px 18px; border-left: 4px solid #0d2b1e; background: #e4eee7; }
            img { max-width: 100%; height: auto; }
            pre { overflow: auto; padding: 14px; background: #e9eee9; }
            a { color: #0d5f3a; }
            :root { color-scheme: light; }
          </style>
        </head>
        <body>
          <article>
            <h1>\(escape(document.title))</h1>
            <div class="meta">\(metadata)</div>
            \(summaryHTML(summary))
            \(body)
          </article>
        </body>
        </html>
        """
    }

    private func metadata(_ document: ArticleExportDocument) -> String {
        [
            document.author.map { "作者：\(escape($0))" },
            document.source.map { "来源：\(escape($0))" },
            document.publishedAt.map { "发布：\(escape($0))" },
            document.originalURL.map { "<a href=\"\(escapeAttribute($0))\">原文链接</a>" },
        ]
        .compactMap { $0 }
        .joined(separator: " · ")
    }

    private func summaryHTML(_ summary: String?) -> String {
        guard let summary, !summary.isEmpty else { return "" }
        return "<blockquote>\(escape(summary))</blockquote>"
    }

    private func markdownHTML(_ markdown: String) -> String {
        markdown
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map(markdownParagraphHTML)
            .joined(separator: "\n")
    }

    private func markdownParagraphHTML(_ paragraph: String) -> String {
        if paragraph.hasPrefix("# ") {
            return "<h2>\(markdownInlineHTML(String(paragraph.dropFirst(2))))</h2>"
        }
        return "<p>\(markdownInlineHTML(paragraph))</p>"
    }

    private func markdownInlineHTML(_ text: String) -> String {
        let pattern = #"!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return escape(text).replacingOccurrences(of: "\n", with: "<br>")
        }

        let range = NSRange(text.startIndex..., in: text)
        var output = ""
        var cursor = text.startIndex

        for match in regex.matches(in: text, range: range) {
            guard
                let fullRange = Range(match.range, in: text),
                let altRange = Range(match.range(at: 1), in: text),
                let urlRange = Range(match.range(at: 2), in: text)
            else {
                continue
            }

            output += escape(String(text[cursor..<fullRange.lowerBound]))
            output += "<img src=\"\(escapeAttribute(String(text[urlRange])))\" alt=\"\(escapeAttribute(String(text[altRange])))\">"
            cursor = fullRange.upperBound
        }

        output += escape(String(text[cursor...]))
        return output.replacingOccurrences(of: "\n", with: "<br>")
    }

    private func escape(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func escapeAttribute(_ text: String) -> String {
        escape(text).replacingOccurrences(of: "'", with: "&#39;")
    }
}
