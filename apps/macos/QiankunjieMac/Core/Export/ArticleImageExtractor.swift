import AppKit
import Foundation

struct ArticleImageReference: Hashable, Sendable {
    let url: URL
    let alt: String
}

struct ArticleExportImage: Identifiable, Sendable {
    let id: Int
    let reference: ArticleImageReference
    let data: Data
    let fileExtension: String
    let mimeType: String
    let pixelSize: CGSize
}

enum ArticleImageExtractor {
    static func markdownImageURL(in line: String, baseURL: URL?) -> URL? {
        let pattern = #"!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(line.startIndex..., in: line)
        guard
            let match = regex.firstMatch(in: line, range: range),
            let sourceRange = Range(match.range(at: 2), in: line)
        else {
            return nil
        }
        return resolvedURL(String(line[sourceRange]), baseURL: baseURL)
    }

    static func references(
        markdown: String,
        html: String? = nil,
        baseURL: URL? = nil
    ) -> [ArticleImageReference] {
        let markdownReferences = references(markdown: markdown, baseURL: baseURL)
        let htmlReferences = references(html: html, baseURL: baseURL)
        var seen: Set<URL> = []
        return (markdownReferences + htmlReferences).filter { seen.insert($0.url).inserted }
    }

    static func references(
        markdown: String,
        baseURL: URL? = nil
    ) -> [ArticleImageReference] {
        let pattern = #"!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(markdown.startIndex..., in: markdown)
        return regex.matches(in: markdown, range: range).compactMap { match in
            guard
                match.numberOfRanges >= 3,
                let altRange = Range(match.range(at: 1), in: markdown),
                let sourceRange = Range(match.range(at: 2), in: markdown),
                let url = resolvedURL(String(markdown[sourceRange]), baseURL: baseURL)
            else {
                return nil
            }
            return ArticleImageReference(url: url, alt: String(markdown[altRange]))
        }
    }

    static func references(
        html: String?,
        baseURL: URL? = nil
    ) -> [ArticleImageReference] {
        guard let html, let regex = try? NSRegularExpression(
            pattern: #"<img\b[^>]*>"#,
            options: [.caseInsensitive]
        ) else {
            return []
        }

        let range = NSRange(html.startIndex..., in: html)
        return regex.matches(in: html, range: range).compactMap { match in
            guard let tagRange = Range(match.range, in: html) else { return nil }
            let tag = String(html[tagRange])
            guard
                let source = imageSource(in: tag),
                let url = resolvedURL(source, baseURL: baseURL)
            else {
                return nil
            }
            return ArticleImageReference(url: url, alt: attribute("alt", in: tag) ?? "")
        }
    }

    private static func imageSource(in tag: String) -> String? {
        for name in ["data-src", "data-original", "data-lazy-src", "src"] {
            if let value = attribute(name, in: tag) {
                return value
            }
        }
        return nil
    }

    private static func attribute(_ name: String, in tag: String) -> String? {
        let pattern = "\\b" + NSRegularExpression.escapedPattern(for: name) + "\\s*=\\s*[\"']([^\"']+)[\"']"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let range = NSRange(tag.startIndex..., in: tag)
        guard
            let match = regex.firstMatch(in: tag, range: range),
            let valueRange = Range(match.range(at: 1), in: tag)
        else {
            return nil
        }
        return decodeHTML(String(tag[valueRange]))
    }

    private static func resolvedURL(_ value: String, baseURL: URL?) -> URL? {
        let decoded = decodeHTML(value.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !decoded.isEmpty else { return nil }
        guard let url = URL(string: decoded, relativeTo: baseURL)?.absoluteURL else { return nil }
        guard let scheme = url.scheme?.lowercased(), ["http", "https", "file"].contains(scheme) else {
            return nil
        }
        return url
    }

    private static func decodeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&#38;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}

struct ArticleImageLoader: Sendable {
    func load(_ references: [ArticleImageReference]) async -> [ArticleExportImage] {
        var images: [ArticleExportImage] = []

        for reference in references {
            do {
                let data: Data
                if reference.url.isFileURL {
                    data = try Data(contentsOf: reference.url)
                } else {
                    let (loaded, _) = try await URLSession.shared.data(from: reference.url)
                    data = loaded
                }

                guard let image = NSImage(data: data), image.size.width > 0, image.size.height > 0 else {
                    continue
                }

                let fileExtension = normalizedExtension(reference.url.pathExtension)
                images.append(
                    ArticleExportImage(
                        id: images.count + 1,
                        reference: reference,
                        data: data,
                        fileExtension: fileExtension,
                        mimeType: mimeType(for: fileExtension),
                        pixelSize: image.size
                    )
                )
            } catch {
                continue
            }
        }

        return images
    }

    private func normalizedExtension(_ value: String) -> String {
        let lower = value.lowercased()
        switch lower {
        case "jpg", "jpeg", "png", "gif", "webp", "heic":
            return lower == "jpg" ? "jpeg" : lower
        default:
            return "png"
        }
    }

    private func mimeType(for fileExtension: String) -> String {
        switch fileExtension {
        case "jpeg": "image/jpeg"
        case "gif": "image/gif"
        case "webp": "image/webp"
        case "heic": "image/heic"
        default: "image/png"
        }
    }
}
