import Foundation

enum ArticleExportFormat: String, CaseIterable, Identifiable, Sendable {
    case markdown
    case html
    case pdf
    case word
    case plainText
    case epub

    var id: String { rawValue }

    var title: String {
        switch self {
        case .markdown: "Markdown"
        case .html: "HTML"
        case .pdf: "PDF"
        case .word: "Word"
        case .plainText: "纯文本"
        case .epub: "EPUB"
        }
    }

    var fileExtension: String {
        switch self {
        case .markdown: "md"
        case .html: "html"
        case .pdf: "pdf"
        case .word: "docx"
        case .plainText: "txt"
        case .epub: "epub"
        }
    }
}

struct ArticleExportDocument: Sendable {
    let title: String
    let author: String?
    let source: String?
    let originalURL: String?
    let publishedAt: String?
    let savedAt: String?
    let aiSummary: String?
    let category: String?
    let tags: [String]
    let contentMarkdown: String?
    let contentHTML: String?

    init(
        title: String?,
        author: String? = nil,
        source: String? = nil,
        originalURL: String? = nil,
        publishedAt: String? = nil,
        savedAt: String? = nil,
        aiSummary: String? = nil,
        category: String? = nil,
        tags: [String] = [],
        contentMarkdown: String? = nil,
        contentHTML: String? = nil
    ) {
        let normalizedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.title = normalizedTitle.isEmpty ? "未命名文章" : normalizedTitle
        self.author = author
        self.source = source
        self.originalURL = originalURL
        self.publishedAt = publishedAt
        self.savedAt = savedAt
        self.aiSummary = aiSummary
        self.category = category
        self.tags = tags
        self.contentMarkdown = contentMarkdown
        self.contentHTML = contentHTML
    }

    var preferredMarkdown: String {
        if let contentMarkdown = contentMarkdown?.trimmingCharacters(in: .whitespacesAndNewlines),
           !contentMarkdown.isEmpty {
            return contentMarkdown
        }

        if let contentHTML, !contentHTML.isEmpty {
            return HTMLTextConverter.markdown(from: contentHTML)
        }

        return ""
    }

    /// WKWebView 不应把 qiankunjie:// 自定义协议当作导出资源基础地址。
    var webExportBaseURL: URL? {
        guard
            let originalURL,
            let url = URL(string: originalURL),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            return nil
        }
        return url
    }
}

func safeExportFileName(_ title: String, fallback: String = "未命名文章") -> String {
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    let source = trimmed.isEmpty ? fallback : trimmed
    let illegal = CharacterSet(charactersIn: #"/\:*?"<>|"#)
    let cleanedScalars = source.unicodeScalars.map { scalar -> Character in
        illegal.contains(scalar) ? "-" : Character(String(scalar))
    }
    let cleaned = String(cleanedScalars)
        .replacingOccurrences(of: "-+", with: "-", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "-. "))
    return cleaned.isEmpty ? fallback : cleaned
}

enum HTMLTextConverter {
    static func markdown(from html: String) -> String {
        var text = html
        text = text.replacingOccurrences(
            of: "<(br|BR)\\s*/?>",
            with: "\n",
            options: .regularExpression
        )
        text = text.replacingOccurrences(
            of: "</(p|P|div|DIV|h[1-6]|H[1-6]|li|LI)>",
            with: "\n\n",
            options: .regularExpression
        )
        text = text.replacingOccurrences(
            of: "<[^>]+>",
            with: "",
            options: .regularExpression
        )
        text = decodeEntities(text)
        return text
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    static func plainText(from html: String) -> String {
        markdown(from: html)
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
