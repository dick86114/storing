import Foundation

struct MarkdownArticleRenderer: Sendable {
    func render(_ document: ArticleExportDocument) -> String {
        var sections: [String] = [frontmatter(document)]

        if let summary = document.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !summary.isEmpty {
            sections.append("> \(summary)")
        }

        let body = document.preferredMarkdown.trimmingCharacters(in: .whitespacesAndNewlines)
        if !body.isEmpty {
            sections.append(body)
        }

        if let supplementalImages = supplementalImageMarkdown(document) {
            sections.append(supplementalImages)
        }

        return sections
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: "\n\n")
    }

    private func supplementalImageMarkdown(_ document: ArticleExportDocument) -> String? {
        let baseURL = document.originalURL.flatMap(URL.init(string:))
        let markdownReferences = ArticleImageExtractor.references(
            markdown: document.preferredMarkdown,
            baseURL: baseURL
        )
        let htmlReferences = ArticleImageExtractor.references(
            html: document.contentHTML,
            baseURL: baseURL
        )
        let existingURLs = Set(markdownReferences.map(\.url))
        let missingReferences = htmlReferences.filter { !existingURLs.contains($0.url) }
        guard !missingReferences.isEmpty else { return nil }

        return missingReferences.map {
            "![\($0.alt)](\($0.url.absoluteString))"
        }.joined(separator: "\n\n")
    }

    private func frontmatter(_ document: ArticleExportDocument) -> String {
        var lines = ["---"]
        lines.append("title: \(yamlValue(document.title))")
        append("author", document.author, to: &lines)
        append("source", document.source, to: &lines)
        if let url = document.originalURL?.trimmingCharacters(in: .whitespacesAndNewlines), !url.isEmpty {
            lines.append("url: \(url)")
        }
        append("published", document.publishedAt, to: &lines)
        append("saved", document.savedAt, to: &lines)
        append("category", document.category, to: &lines)

        if document.tags.isEmpty {
            lines.append("tags: []")
        } else {
            lines.append("tags:")
            lines.append(contentsOf: document.tags.map { "  - \(yamlValue($0))" })
        }

        append("summary", document.aiSummary, to: &lines)
        lines.append("---")
        return lines.joined(separator: "\n")
    }

    private func append(_ key: String, _ value: String?, to lines: inout [String]) {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        lines.append("\(key): \(yamlValue(value))")
    }

    private func yamlValue(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.contains(":") || trimmed.contains("#") || trimmed.contains("\"") {
            return "\"\(trimmed.replacingOccurrences(of: "\"", with: "\\\""))\""
        }
        return trimmed
    }
}
