import Foundation

struct PlainTextArticleRenderer: Sendable {
    func render(_ document: ArticleExportDocument) -> String {
        var lines: [String] = [document.title]

        let metadata = [
            document.author.map { "作者：\($0)" },
            document.source.map { "来源：\($0)" },
            document.publishedAt.map { "发布：\($0)" },
            document.originalURL,
        ]
        .compactMap { $0 }
        if !metadata.isEmpty {
            lines.append(metadata.joined(separator: " · "))
        }

        if let summary = document.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !summary.isEmpty {
            lines.append("")
            lines.append(summary)
        }

        let body: String
        if let html = document.contentHTML,
           WeChatArticleTranscript.isTranscript(html),
           let transcriptText = WeChatArticleTranscript.plainText(from: html) {
            body = transcriptText
        } else if let markdown = document.contentMarkdown?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !markdown.isEmpty {
            body = markdown
                .replacingOccurrences(of: "^#+\\s*", with: "", options: .regularExpression)
                .replacingOccurrences(of: "[*_`>]", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else if let html = document.contentHTML {
            body = HTMLTextConverter.plainText(from: html)
        } else {
            body = ""
        }

        if !body.isEmpty {
            lines.append("")
            lines.append(body)
        }

        return lines.joined(separator: "\n")
    }
}
