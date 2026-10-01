import Foundation

struct DocxArticleRenderer: Sendable {
    func render(_ document: ArticleExportDocument, to url: URL) async throws {
        let references = ArticleImageExtractor.references(
            markdown: document.preferredMarkdown,
            html: document.contentHTML,
            baseURL: document.originalURL.flatMap(URL.init(string:))
        )
        let images = await ArticleImageLoader().load(references)
        let fileManager = FileManager.default
        let root = fileManager.temporaryDirectory
            .appendingPathComponent("storing-docx-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: root) }

        try write("[Content_Types].xml", contentTypes(images), to: root)
        try write("_rels/.rels", rootRelationships, to: root)
        try write("word/document.xml", documentXML(document, images: images), to: root)
        try write("word/styles.xml", stylesXML, to: root)
        try write("word/_rels/document.xml.rels", documentRelationships(images), to: root)

        for image in images {
            try writeData(
                "word/media/image\(image.id).\(image.fileExtension)",
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
        process.arguments = ["-q", "-r", url.path, "."]
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw CocoaError(.fileWriteUnknown)
        }
    }

    private func documentXML(_ document: ArticleExportDocument, images: [ArticleExportImage]) -> String {
        var paragraphs: [String] = []
        var insertedImageIDs: Set<Int> = []
        paragraphs.append(paragraph(document.title, style: "Title"))

        let metadata = [
            document.author.map { "作者：\($0)" },
            document.source.map { "来源：\($0)" },
            document.publishedAt.map { "发布：\($0)" },
            document.originalURL,
        ]
        .compactMap { $0 }
        if !metadata.isEmpty {
            paragraphs.append(paragraph(metadata.joined(separator: " · "), style: "Subtitle"))
        }

        if let summary = document.aiSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !summary.isEmpty {
            paragraphs.append(paragraph(summary, style: "Quote"))
        }

        paragraphs.append(contentsOf: markdownParagraphs(
            document.preferredMarkdown,
            baseURL: document.originalURL.flatMap(URL.init(string:)),
            images: images,
            insertedImageIDs: &insertedImageIDs
        ))
        paragraphs.append(contentsOf: imageParagraphs(
            images.filter { !insertedImageIDs.contains($0.id) }
        ))

        return """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
          xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
          xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <w:body>
            \(paragraphs.joined(separator: "\n"))
            <w:sectPr>
              <w:pgSz w:w="11906" w:h="16838"/>
              <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
            </w:sectPr>
          </w:body>
        </w:document>
        """
    }

    private func markdownParagraphs(
        _ markdown: String,
        baseURL: URL?,
        images: [ArticleExportImage],
        insertedImageIDs: inout Set<Int>
    ) -> [String] {
        var result: [String] = []
        var inCode = false

        for rawLine in markdown.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("```") {
                inCode.toggle()
                continue
            }
            if inCode {
                result.append(paragraph(rawLine, style: "Code"))
                continue
            }
            if line.isEmpty {
                continue
            }
            if let imageURL = ArticleImageExtractor.markdownImageURL(in: line, baseURL: baseURL) {
                if let image = images.first(where: { $0.reference.url == imageURL }) {
                    insertedImageIDs.insert(image.id)
                    result.append(imageParagraph(image))
                }
                continue
            }
            if line.hasPrefix("#") {
                let level = min(line.prefix(while: { $0 == "#" }).count, 3)
                result.append(paragraph(String(line.dropFirst(level)).trimmingCharacters(in: .whitespaces), style: "Heading\(level)"))
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                result.append(paragraph("• \(String(line.dropFirst(2)))", style: "ListParagraph"))
            } else if line.hasPrefix("> ") {
                result.append(paragraph(String(line.dropFirst(2)), style: "Quote"))
            } else {
                result.append(paragraph(line))
            }
        }
        return result
    }

    private func paragraph(_ text: String, style: String? = nil) -> String {
        let styleXML = style.map {
            "<w:pPr><w:pStyle w:val=\"\($0)\"/></w:pPr>"
        } ?? ""
        let runs = text.components(separatedBy: "\n").enumerated().map { index, line in
            let breakXML = index == 0 ? "" : "<w:r><w:br/></w:r>"
            return "\(breakXML)<w:r><w:t xml:space=\"preserve\">\(escape(line))</w:t></w:r>"
        }.joined()
        return "<w:p>\(styleXML)\(runs)</w:p>"
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

    private func imageParagraphs(_ images: [ArticleExportImage]) -> [String] {
        guard !images.isEmpty else { return [] }
        return [paragraph("图片", style: "Heading2")] + images.map(imageParagraph)
    }


    private func imageParagraph(_ image: ArticleExportImage) -> String {
        let maxWidth: Double = 5_029_200
        let ratio = image.pixelSize.height / max(image.pixelSize.width, 1)
        let height = max(900_000, min(maxWidth * ratio, 6_858_000))
        let relationshipID = "rIdImage\(image.id)"

        return """
        <w:p>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="\(Int(maxWidth))" cy="\(Int(height))"/>
                <wp:docPr id="\(image.id)" name="图片 \(image.id)"/>
                <a:graphic>
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic>
                      <pic:nvPicPr><pic:cNvPr id="\(image.id)" name="image\(image.id).\(image.fileExtension)"/><pic:cNvPicPr/></pic:nvPicPr>
                      <pic:blipFill><a:blip r:embed="\(relationshipID)"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                      <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\(Int(maxWidth))" cy="\(Int(height))"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
        """
    }

    private func escape(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func contentTypes(_ images: [ArticleExportImage]) -> String {
        let imageDefaults = Set(images.map(\.fileExtension)).map { fileExtension in
            let mimeType = images.first { $0.fileExtension == fileExtension }?.mimeType ?? "image/png"
            return "<Default Extension=\"\(fileExtension)\" ContentType=\"\(mimeType)\"/>"
        }.joined(separator: "\n  ")

        return """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          \(imageDefaults)
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
        </Types>
        """
    }

    private var rootRelationships: String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>
        """
    }

    private func documentRelationships(_ images: [ArticleExportImage]) -> String {
        let imageRelationships = images.map { image in
            """
            <Relationship Id="rIdImage\(image.id)" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image\(image.id).\(image.fileExtension)"/>
            """
        }.joined(separator: "\n  ")

        return """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
          \(imageRelationships)
        </Relationships>
        """
    }

    private var stylesXML: String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
          <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="607064"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/></w:rPr></w:style>
          <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>
        </w:styles>
        """
    }
}
