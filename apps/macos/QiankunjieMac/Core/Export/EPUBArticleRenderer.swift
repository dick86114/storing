import Foundation

struct EPUBArticleRenderer: Sendable {
    func render(_ document: ArticleExportDocument, to url: URL) async throws {
        let references = ArticleImageExtractor.references(
            markdown: document.preferredMarkdown,
            html: document.contentHTML,
            baseURL: document.originalURL.flatMap(URL.init(string:))
        )
        let images = await ArticleImageLoader().load(references)
        let fileManager = FileManager.default
        let root = fileManager.temporaryDirectory
            .appendingPathComponent("storing-epub-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: root) }

        try write("mimetype", "application/epub+zip", to: root)
        try write("META-INF/container.xml", containerXML, to: root)
        try write("OEBPS/content.opf", contentOPF(document, images: images), to: root)
        try write("OEBPS/nav.xhtml", navXHTML(document), to: root)
        try write("OEBPS/chapter.xhtml", chapterXHTML(document, images: images), to: root)
        for image in images {
            try writeData(
                "OEBPS/images/image\(image.id).\(image.fileExtension)",
                image.data,
                to: root
            )
        }

        if fileManager.fileExists(atPath: url.path) {
            try fileManager.removeItem(at: url)
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/zip")
        process.currentDirectoryURL = root
        process.arguments = ["-q", "-r", "-X", url.path, "mimetype", "META-INF", "OEBPS"]
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw CocoaError(.fileWriteUnknown)
        }
    }

    private func chapterXHTML(_ document: ArticleExportDocument, images: [ArticleExportImage]) -> String {
        var body: [String] = ["<h1>\(escape(document.title))</h1>"]
        var insertedImageIDs: Set<Int> = []
        if let summary = document.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !summary.isEmpty {
            body.append("<blockquote>\(escape(summary))</blockquote>")
        }
        body.append(contentsOf: markdownParagraphs(
            document.preferredMarkdown,
            baseURL: document.originalURL.flatMap(URL.init(string:)),
            images: images,
            insertedImageIDs: &insertedImageIDs
        ))

        let remainingImages = images.filter { !insertedImageIDs.contains($0.id) }
        if !remainingImages.isEmpty {
            body.append("<h2>图片</h2>")
            body.append(contentsOf: remainingImages.map {
                "<div><img src=\"images/image\($0.id).\($0.fileExtension)\" alt=\"\(escape($0.reference.alt))\"/></div>"
            })
        }

        return """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
        <head><title>\(escape(document.title))</title></head>
        <body>\(body.joined(separator: "\n"))</body>
        </html>
        """
    }

    private func navXHTML(_ document: ArticleExportDocument) -> String {
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
        <head><title>目录</title></head>
        <body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">\(escape(document.title))</a></li></ol></nav></body>
        </html>
        """
    }

    private func contentOPF(
        _ document: ArticleExportDocument,
        images: [ArticleExportImage]
    ) -> String {
        let identifier = "urn:storing:\(UUID().uuidString)"
        let author = document.author.map { "<dc:creator>\(escape($0))</dc:creator>" } ?? ""
        let imageManifest = images.map { image in
            "<item id=\"image\(image.id)\" href=\"images/image\(image.id).\(image.fileExtension)\" media-type=\"\(image.mimeType)\"/>"
        }.joined(separator: "\n    ")
        return """
        <?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:identifier id="book-id">\(identifier)</dc:identifier>
            <dc:title>\(escape(document.title))</dc:title>
            <dc:language>zh-CN</dc:language>
            \(author)
          </metadata>
          <manifest>
            <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
            <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
            \(imageManifest)
          </manifest>
          <spine><itemref idref="chapter"/></spine>
        </package>
        """
    }

    private func markdownParagraphs(
        _ markdown: String,
        baseURL: URL?,
        images: [ArticleExportImage],
        insertedImageIDs: inout Set<Int>
    ) -> [String] {
        markdown.components(separatedBy: "\n\n").compactMap { block in
            let text = block.trimmingCharacters(in: .whitespacesAndNewlines)
            if let imageURL = ArticleImageExtractor.markdownImageURL(in: text, baseURL: baseURL) {
                guard let image = images.first(where: { $0.reference.url == imageURL }) else {
                    return nil
                }
                insertedImageIDs.insert(image.id)
                return "<div><img src=\"images/image\(image.id).\(image.fileExtension)\" alt=\"\(escape(image.reference.alt))\"/></div>"
            }
            if text.hasPrefix("# ") {
                return "<h2>\(escape(String(text.dropFirst(2))))</h2>"
            }
            if text.hasPrefix("> ") {
                return "<blockquote>\(escape(String(text.dropFirst(2))))</blockquote>"
            }
            if text.hasPrefix("- ") {
                let items = text.components(separatedBy: .newlines)
                    .map { $0.replacingOccurrences(of: "^-\\s*", with: "", options: .regularExpression) }
                    .map { "<li>\(escape($0))</li>" }
                    .joined()
                return "<ul>\(items)</ul>"
            }
            return "<p>\(escape(text))</p>"
        }
    }


    private func write(_ relativePath: String, _ content: String, to root: URL) throws {
        let url = root.appendingPathComponent(relativePath)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try content.data(using: .utf8)?.write(to: url)
    }

    private func writeData(_ relativePath: String, _ data: Data, to root: URL) throws {
        let url = root.appendingPathComponent(relativePath)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: url)
    }

    private func escape(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private var containerXML: String {
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
        </container>
        """
    }
}
