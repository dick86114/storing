import Foundation

struct ObsidianExportDraft: Identifiable, Equatable, Sendable {
    let id: UUID
    var title: String
    var vaultURL: URL?
    var destinationURL: URL?

    init(
        id: UUID = UUID(),
        articleTitle: String?,
        vaultURL: URL? = nil,
        destinationURL: URL? = nil
    ) {
        let normalizedTitle = articleTitle?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.id = id
        self.title = normalizedTitle.isEmpty ? "未命名文章" : normalizedTitle
        self.vaultURL = vaultURL
        self.destinationURL = destinationURL
    }

    var directoryURL: URL? {
        destinationURL ?? vaultURL
    }

    var relativeDirectoryPath: String {
        guard let vaultURL, let destinationURL else {
            return "根目录"
        }

        let vaultPath = vaultURL.standardizedFileURL.path
        let destinationPath = destinationURL.standardizedFileURL.path
        guard destinationPath != vaultPath else {
            return "根目录"
        }

        let prefix = vaultPath.hasSuffix("/") ? vaultPath : "\(vaultPath)/"
        guard destinationPath.hasPrefix(prefix) else {
            return destinationPath
        }

        return String(destinationPath.dropFirst(prefix.count))
    }

    func resolvedDocument(from document: ArticleExportDocument) -> ArticleExportDocument {
        ArticleExportDocument(
            title: title,
            author: document.author,
            source: document.source,
            originalURL: document.originalURL,
            publishedAt: document.publishedAt,
            savedAt: document.savedAt,
            aiSummary: document.aiSummary,
            category: document.category,
            tags: document.tags,
            contentMarkdown: document.contentMarkdown,
            contentHTML: document.contentHTML
        )
    }
}
