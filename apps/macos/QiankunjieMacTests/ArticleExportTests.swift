import Foundation
import AppKit
import Testing
@testable import QiankunjieMac

struct ArticleExportTests {
    @Test func Markdown导出包含完整元数据与正文() {
        let document = ArticleExportDocument(
            title: "测试文章",
            author: "测试作者",
            source: "测试来源",
            originalURL: "https://example.com/article",
            publishedAt: "2026-10-01",
            savedAt: "2026-10-02",
            aiSummary: "这是一段摘要。",
            category: "AI 工程",
            tags: ["Swift", "导出"],
            contentMarkdown: "# 正文标题\n\n正文内容。",
            contentHTML: nil
        )

        let result = MarkdownArticleRenderer().render(document)

        #expect(result.contains("title: 测试文章"))
        #expect(result.contains("author: 测试作者"))
        #expect(result.contains("source: 测试来源"))
        #expect(result.contains("url: https://example.com/article"))
        #expect(result.contains("published: 2026-10-01"))
        #expect(result.contains("saved: 2026-10-02"))
        #expect(result.contains("category: AI 工程"))
        #expect(result.contains("  - Swift"))
        #expect(result.contains("summary: 这是一段摘要。"))
        #expect(result.contains("# 正文标题"))
        #expect(result.contains("正文内容。"))
    }

    @Test func Markdown缺少时从HTML回退转换() {
        let document = ArticleExportDocument(
            title: "HTML 文章",
            contentMarkdown: nil,
            contentHTML: "<article><h1>标题</h1><p>第一段</p><p>第二段</p></article>"
        )

        let result = MarkdownArticleRenderer().render(document)

        #expect(result.contains("标题"))
        #expect(result.contains("第一段"))
        #expect(result.contains("第二段"))
    }

    @Test func 微信聊天记录导出清除样式并按消息内联图片() {
        let document = ArticleExportDocument(
            title: "微信聊天记录",
            contentMarkdown: ".wechat-chat{max-width:100%;}聊天记录\n\nApex17:05\n\n图片后文字\n\n![图片](https://img.example.com/a.png)",
            contentHTML: [
                "<style>.wechat-chat{max-width:100%;}</style>",
                "<div class=\"wechat-chat\">",
                "<div class=\"wechat-chat-head\"><p class=\"wechat-chat-title\">聊天记录</p>",
                "<p class=\"wechat-chat-date\">2026年5月12日</p></div>",
                "<div class=\"wechat-msg\">",
                "<div class=\"wechat-msg-head\"><span class=\"wechat-msg-sender\">Apex</span>",
                "<span class=\"wechat-msg-time\">17:05</span></div>",
                "<div class=\"wechat-msg-body\"><p>brew install rtk</p>",
                "<p><img src=\"https://img.example.com/a.png\" alt=\"聊天截图\"></p>",
                "<p>图片后文字</p></div></div></div>",
            ].joined()
        )

        let markdown = MarkdownArticleRenderer().render(document)

        #expect(!markdown.contains(".wechat-chat"))
        #expect(markdown.contains("**Apex** · 17:05"))
        let imageIndex = markdown.range(of: "![聊天截图](https://img.example.com/a.png)")?.lowerBound
        let textIndex = markdown.range(of: "图片后文字")?.lowerBound
        #expect(imageIndex != nil)
        #expect(textIndex != nil)
        if let imageIndex, let textIndex {
            #expect(imageIndex < textIndex)
        }
    }

    @Test func 微信聊天记录纯文本使用易读时间线排版() {
        let document = ArticleExportDocument(
            title: "微信聊天记录",
            contentMarkdown: ".wechat-chat{max-width:100%;}聊天记录\n\nApex17:05\n\n安装命令",
            contentHTML: [
                "<style>.wechat-chat{max-width:100%;}</style>",
                "<div class=\"wechat-chat\">",
                "<div class=\"wechat-chat-head\"><p class=\"wechat-chat-title\">聊天记录</p>",
                "<p class=\"wechat-chat-date\">2026年5月12日</p></div>",
                "<div class=\"wechat-msg\">",
                "<div class=\"wechat-msg-head\"><span class=\"wechat-msg-sender\">Apex</span>",
                "<span class=\"wechat-msg-time\">17:05</span></div>",
                "<div class=\"wechat-msg-body\"><p>安装命令</p>",
                "<p><img src=\"https://img.example.com/a.png\" alt=\"聊天截图\"></p></div>",
                "</div></div>",
            ].joined()
        )

        let result = PlainTextArticleRenderer().render(document)

        #expect(result.contains("聊天记录\n2026年5月12日"))
        #expect(result.contains("Apex · 17:05\n安装命令"))
        #expect(result.contains("[图片：聊天截图] https://img.example.com/a.png"))
        #expect(!result.contains(".wechat-chat"))
    }

    @Test func Markdown导出补充HTML正文图片并解析相对地址() {
        let document = ArticleExportDocument(
            title: "HTML 图片文章",
            originalURL: "https://example.com/posts/demo",
            contentMarkdown: "正文内容",
            contentHTML: "<p>正文内容</p><img src=\"/images/cover.png\" alt=\"封面\">"
        )

        let result = MarkdownArticleRenderer().render(document)

        #expect(result.contains("![封面](https://example.com/images/cover.png)"))
    }

    @Test func 空标题导出回退为未命名文章() {
        let document = ArticleExportDocument(title: "   ")

        let result = MarkdownArticleRenderer().render(document)

        #expect(result.contains("title: 未命名文章"))
    }

    @Test func 文件名会清理非法字符() {
        let name = safeExportFileName(#"a/b\c:d*e?f"g<h>i|j"#, fallback: "未命名文章")

        #expect(name == "a-b-c-d-e-f-g-h-i-j")
        #expect(!name.contains("/"))
        #expect(!name.contains(":"))
        #expect(!name.contains("*"))
        #expect(!name.contains("?"))
    }

    @Test func 导出WebView基础地址只接受HTTP协议() {
        let weChatImport = ArticleExportDocument(
            title: "微信转发内容",
            originalURL: "qiankunjie://wechat-import/b2737420-c8c8-4403-9b53-b4f3efece30"
        )
        let httpsArticle = ArticleExportDocument(
            title: "普通文章",
            originalURL: "https://example.com/article"
        )

        #expect(weChatImport.webExportBaseURL == nil)
        #expect(httpsArticle.webExportBaseURL?.absoluteString == "https://example.com/article")
    }

    @Test func HTML导出生成可独立打开的完整文档() {
        let document = ArticleExportDocument(
            title: "HTML 文章",
            aiSummary: "摘要内容",
            contentHTML: "<article><h1>标题</h1><p>正文</p></article>"
        )

        let result = HTMLArticleRenderer().render(document)

        #expect(result.lowercased().contains("<!doctype html>"))
        #expect(result.contains("HTML 文章"))
        #expect(result.contains("摘要内容"))
        #expect(result.contains("<h1>标题</h1>"))
        #expect(result.contains("正文"))
    }

    @Test func HTML从Markdown回退时保留图片() {
        let document = ArticleExportDocument(
            title: "Markdown 图片文章",
            contentMarkdown: "正文\n\n![配图](https://img.example.com/a.png)"
        )

        let result = HTMLArticleRenderer().render(document)

        #expect(result.contains("<img src=\"https://img.example.com/a.png\" alt=\"配图\""))
        #expect(!result.contains("![配图]"))
    }

    @Test func HTML导出固定使用浅色主题() {
        let document = ArticleExportDocument(title: "浅色文章", contentHTML: "<p>正文</p>")

        let result = HTMLArticleRenderer().render(document)

        #expect(result.contains("color-scheme: light"))
        #expect(!result.contains("prefers-color-scheme"))
    }

    @Test func HTML导出不把自定义协议渲染为链接() {
        let document = ArticleExportDocument(
            title: "微信转发内容",
            originalURL: "qiankunjie://wechat-import/b2737420-c8c8-4403-9b53-b4f3efece30",
            contentHTML: "<p>正文</p>"
        )

        let result = HTMLArticleRenderer().render(document)

        #expect(!result.contains("<a href=\"qiankunjie://"))
        #expect(result.contains("原文链接：qiankunjie://wechat-import/"))
    }

    @Test func 纯文本导出去除HTML标签() {
        let document = ArticleExportDocument(
            title: "纯文本文章",
            contentHTML: "<p>第一段</p><p>第二段 &amp; 更多</p>"
        )

        let result = PlainTextArticleRenderer().render(document)

        #expect(!result.contains("<p>"))
        #expect(result.contains("第一段"))
        #expect(result.contains("第二段 & 更多"))
    }

    @MainActor
    @Test func PDF导出生成非空文件() async throws {
        let document = ArticleExportDocument(
            title: "PDF 文章",
            aiSummary: "PDF 摘要",
            contentHTML: "<article><h1>PDF 标题</h1><p>PDF 正文</p></article>"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).pdf")
        defer { try? FileManager.default.removeItem(at: url) }

        try await PDFArticleRenderer().render(document, to: url)

        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        let size = attributes[.size] as? NSNumber
        #expect(size?.intValue ?? 0 > 0)
        #expect(url.pathExtension == "pdf")
    }

    @MainActor
    @Test func PDF导出微信自定义原文链接不触发协议解析() async throws {
        let document = ArticleExportDocument(
            title: "微信转发内容",
            originalURL: "qiankunjie://wechat-import/b2737420-c8c8-4403-9b53-b4f3efece30",
            contentHTML: "<article><p>微信转发正文</p></article>"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).pdf")
        defer { try? FileManager.default.removeItem(at: url) }

        try await PDFArticleRenderer().render(document, to: url)

        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        let size = attributes[.size] as? NSNumber
        #expect(size?.intValue ?? 0 > 0)
    }

    @MainActor
    @Test func Word导出嵌入本地图片并隐藏Markdown图片语法() async throws {
        let imageURL = try 写入测试图片()
        defer { try? FileManager.default.removeItem(at: imageURL) }
        let document = ArticleExportDocument(
            title: "Word 图片文章",
            contentMarkdown: "正文段落\n\n![配图](\(imageURL.absoluteString) \"图片标题\")\n\n图片后段落"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).docx")
        let extraction = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-docx-export-\(UUID().uuidString)", isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: url)
            try? FileManager.default.removeItem(at: extraction)
        }

        try await DocxArticleRenderer().render(document, to: url)
        let result = try 解压(url, to: extraction)
        let documentXML = try String(
            contentsOf: extraction.appendingPathComponent("word/document.xml"),
            encoding: .utf8
        )

        #expect(result.status == 0)
        #expect(
            FileManager.default.fileExists(
                atPath: extraction.appendingPathComponent("word/media/image1.png").path
            )
        )
        #expect(documentXML.contains("rIdImage1"))
        #expect(!documentXML.contains("![配图]"))
        #expect(!documentXML.contains("file://"))
        let imageIndex = documentXML.range(of: "rIdImage1")?.lowerBound
        let afterImageIndex = documentXML.range(of: "图片后段落")?.lowerBound
        #expect(imageIndex != nil)
        #expect(afterImageIndex != nil)
        if let imageIndex, let afterImageIndex {
            #expect(imageIndex < afterImageIndex)
        }
    }

    @MainActor
    @Test func Word导出补充HTML正文图片() async throws {
        let imageURL = try 写入测试图片()
        defer { try? FileManager.default.removeItem(at: imageURL) }
        let document = ArticleExportDocument(
            title: "Word HTML 图片",
            contentMarkdown: "正文只有文字",
            contentHTML: "<p>正文只有文字</p><img src=\"\(imageURL.absoluteString)\">"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).docx")
        let extraction = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-docx-html-export-\(UUID().uuidString)", isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: url)
            try? FileManager.default.removeItem(at: extraction)
        }

        try await DocxArticleRenderer().render(document, to: url)
        _ = try 解压(url, to: extraction)
        let documentXML = try String(
            contentsOf: extraction.appendingPathComponent("word/document.xml"),
            encoding: .utf8
        )

        #expect(
            FileManager.default.fileExists(
                atPath: extraction.appendingPathComponent("word/media/image1.png").path
            )
        )
        #expect(documentXML.contains("rIdImage1"))
    }

    @Test func Word导出生成可解压的docx包() async throws {
        let document = ArticleExportDocument(
            title: "Word 文章",
            aiSummary: "Word 摘要",
            contentMarkdown: "# 标题\n\n正文段落\n\n- 列表项"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).docx")
        defer { try? FileManager.default.removeItem(at: url) }

        try await DocxArticleRenderer().render(document, to: url)

        let result = try 运行命令("/usr/bin/unzip", ["-l", url.path])

        #expect(result.status == 0)
        #expect(result.output.contains("[Content_Types].xml"))
        #expect(result.output.contains("_rels/.rels"))
        #expect(result.output.contains("word/document.xml"))
    }

    @MainActor
    @Test func 微信聊天记录Word图片在消息原位且不导出样式代码() async throws {
        let imageURL = try 写入测试图片()
        defer { try? FileManager.default.removeItem(at: imageURL) }
        let document = ArticleExportDocument(
            title: "微信聊天记录",
            contentMarkdown: ".wechat-chat{max-width:100%;}聊天记录\n\nApex17:05\n\n图片后文字\n\n![聊天截图](\(imageURL.absoluteString))",
            contentHTML: [
                "<style>.wechat-chat{max-width:100%;}</style>",
                "<div class=\"wechat-chat\">",
                "<div class=\"wechat-chat-head\"><p class=\"wechat-chat-title\">聊天记录</p>",
                "<p class=\"wechat-chat-date\">2026年5月12日</p></div>",
                "<div class=\"wechat-msg\">",
                "<div class=\"wechat-msg-head\"><span class=\"wechat-msg-sender\">Apex</span>",
                "<span class=\"wechat-msg-time\">17:05</span></div>",
                "<div class=\"wechat-msg-body\"><p>图片前文字</p>",
                "<p><img src=\"\(imageURL.absoluteString)\" alt=\"聊天截图\"></p>",
                "<p>图片后文字</p></div></div></div>",
            ].joined()
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-wechat-export-\(UUID().uuidString).docx")
        defer { try? FileManager.default.removeItem(at: url) }

        try await DocxArticleRenderer().render(document, to: url)

        let result = try 运行命令("/usr/bin/unzip", ["-p", url.path, "word/document.xml"])
        #expect(result.status == 0)
        #expect(!result.output.contains(".wechat-chat"))
        #expect(!result.output.contains(">图片<"))
        let imageIndex = result.output.range(of: "rIdImage1")?.lowerBound
        let textIndex = result.output.range(of: "图片后文字")?.lowerBound
        #expect(imageIndex != nil)
        #expect(textIndex != nil)
        if let imageIndex, let textIndex {
            #expect(imageIndex < textIndex)
        }
    }

    @Test func Obsidian导出写入Markdown并追加同名序号() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-obsidian-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let document = ArticleExportDocument(title: "重复文章", contentMarkdown: "正文")
        let exporter = ObsidianArticleExporter(
            settings: ObsidianExportSettings(directoryURL: directory, conflictPolicy: .appendNumber)
        )

        let first = try exporter.export(document)
        let second = try exporter.export(document)

        #expect(first.lastPathComponent == "重复文章.md")
        #expect(second.lastPathComponent == "重复文章-2.md")
        #expect(FileManager.default.fileExists(atPath: first.path))
    }

    @Test func Obsidian未配置目录时报错() {
        let exporter = ObsidianArticleExporter(settings: .empty)

        #expect(throws: ObsidianExportError.notConfigured) {
            try exporter.export(ArticleExportDocument(title: "文章"))
        }
    }

    @MainActor
    @Test func EPUB导出嵌入本地图片并写入manifest() async throws {
        let imageURL = try 写入测试图片()
        defer { try? FileManager.default.removeItem(at: imageURL) }
        let document = ArticleExportDocument(
            title: "EPUB 图片文章",
            contentMarkdown: "正文段落\n\n![配图](\(imageURL.absoluteString) \"图片标题\")\n\n图片后段落"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).epub")
        defer { try? FileManager.default.removeItem(at: url) }

        try await EPUBArticleRenderer().render(document, to: url)

        let entries = try 运行命令("/usr/bin/unzip", ["-Z1", url.path])
        let package = try 运行命令("/usr/bin/unzip", ["-p", url.path, "OEBPS/content.opf"])
        let chapter = try 运行命令("/usr/bin/unzip", ["-p", url.path, "OEBPS/chapter.xhtml"])

        #expect(entries.status == 0)
        #expect(entries.output.contains("OEBPS/images/image1.png"))
        #expect(package.output.contains("href=\"images/image1.png\""))
        #expect(package.output.contains("media-type=\"image/png\""))
        #expect(chapter.output.contains("src=\"images/image1.png\""))
        let imageIndex = chapter.output.range(of: "src=\"images/image1.png\"")?.lowerBound
        let afterImageIndex = chapter.output.range(of: "图片后段落")?.lowerBound
        #expect(imageIndex != nil)
        #expect(afterImageIndex != nil)
        if let imageIndex, let afterImageIndex {
            #expect(imageIndex < afterImageIndex)
        }
    }

    @MainActor
    @Test func EPUB导出补充HTML正文图片() async throws {
        let imageURL = try 写入测试图片()
        defer { try? FileManager.default.removeItem(at: imageURL) }
        let document = ArticleExportDocument(
            title: "EPUB HTML 图片",
            contentMarkdown: "正文只有文字",
            contentHTML: "<p>正文只有文字</p><img src=\"\(imageURL.absoluteString)\">"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).epub")
        defer { try? FileManager.default.removeItem(at: url) }

        try await EPUBArticleRenderer().render(document, to: url)

        let entries = try 运行命令("/usr/bin/unzip", ["-Z1", url.path])
        let chapter = try 运行命令("/usr/bin/unzip", ["-p", url.path, "OEBPS/chapter.xhtml"])
        #expect(entries.output.contains("OEBPS/images/image1.png"))
        #expect(chapter.output.contains("src=\"images/image1.png\""))
    }

    @Test func EPUB导出生成标准包结构() async throws {
        let document = ArticleExportDocument(
            title: "EPUB 文章",
            aiSummary: "EPUB 摘要",
            contentMarkdown: "# 标题\n\n正文"
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-export-\(UUID().uuidString).epub")
        defer { try? FileManager.default.removeItem(at: url) }

        try await EPUBArticleRenderer().render(document, to: url)

        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-l", url.path]
        process.standardOutput = pipe
        try process.run()
        process.waitUntilExit()
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

        let listing = try 运行命令("/usr/bin/unzip", ["-lv", url.path])
        let mimetypeLine = listing.output
            .components(separatedBy: .newlines)
            .first { $0.contains("mimetype") } ?? ""

        #expect(process.terminationStatus == 0)
        #expect(mimetypeLine.localizedCaseInsensitiveContains("stored"))
        #expect(output.contains("mimetype"))
        #expect(output.contains("META-INF/container.xml"))
        #expect(output.contains("OEBPS/content.opf"))
        #expect(output.contains("OEBPS/chapter.xhtml"))
    }

    @Test func Obsidian导出草稿默认带入文章标题与根目录() {
        let draft = ObsidianExportDraft(articleTitle: "  原文标题  ")
        let document = ArticleExportDocument(
            title: "原文章标题",
            contentMarkdown: "正文"
        )
        let resolved = draft.resolvedDocument(from: document)

        #expect(draft.title == "原文标题")
        #expect(draft.relativeDirectoryPath == "根目录")
        #expect(resolved.title == "原文标题")
        #expect(resolved.preferredMarkdown == "正文")
    }

    @Test func Obsidian导出草稿计算仓库内相对路径() {
        let vault = URL(fileURLWithPath: "/tmp/我的仓库", isDirectory: true)
        let destination = vault.appendingPathComponent("技术/阅读", isDirectory: true)
        let draft = ObsidianExportDraft(
            articleTitle: "文章",
            vaultURL: vault,
            destinationURL: destination
        )

        #expect(draft.relativeDirectoryPath == "技术/阅读")
        #expect(draft.directoryURL?.path == destination.path)
    }

    @Test func Obsidian导出草稿恢复上次保管库和目录() {
        let suiteName = "storing.obsidian.last-used.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ObsidianExportSettingsStore(defaults: defaults)
        let vaultURL = URL(fileURLWithPath: "/tmp/我的仓库", isDirectory: true)
        let destinationURL = vaultURL.appendingPathComponent("技术/阅读", isDirectory: true)
        store.save(
            ObsidianExportSettings(directoryURL: destinationURL),
            vaultURL: vaultURL
        )

        let draft = ObsidianExportDraft.lastUsed(
            articleTitle: "文章",
            settingsStore: store
        )

        #expect(draft.vaultURL?.standardizedFileURL.path == vaultURL.standardizedFileURL.path)
        #expect(draft.destinationURL?.standardizedFileURL.path == destinationURL.standardizedFileURL.path)
        #expect(draft.relativeDirectoryPath == "技术/阅读")
    }

    @Test func Obsidian导出草稿恢复根目录时保持空路径() {
        let suiteName = "storing.obsidian.last-used-root.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ObsidianExportSettingsStore(defaults: defaults)
        let vaultURL = URL(fileURLWithPath: "/tmp/我的仓库", isDirectory: true)
        store.save(
            ObsidianExportSettings(directoryURL: vaultURL),
            vaultURL: vaultURL
        )

        let draft = ObsidianExportDraft.lastUsed(
            articleTitle: "文章",
            settingsStore: store
        )

        #expect(draft.vaultURL?.standardizedFileURL.path == vaultURL.standardizedFileURL.path)
        #expect(draft.destinationURL == nil)
        #expect(draft.relativeDirectoryPath == "根目录")
    }

    @Test func Obsidian设置分别保存保管库与导出目录() {
        let suiteName = "storing.obsidian.settings.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = ObsidianExportSettingsStore(defaults: defaults)
        let vaultURL = URL(fileURLWithPath: "/tmp/我的仓库", isDirectory: true)
        let destinationURL = vaultURL.appendingPathComponent("技术", isDirectory: true)

        store.save(
            ObsidianExportSettings(directoryURL: destinationURL),
            vaultURL: vaultURL
        )

        #expect(store.loadVaultURL()?.standardizedFileURL.path == vaultURL.standardizedFileURL.path)
        #expect(store.load().directoryURL?.standardizedFileURL.path == destinationURL.standardizedFileURL.path)
    }

    @Test func Obsidian保管库从本机配置读取并按打开状态排序() throws {
        let base = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-obsidian-vaults-\(UUID().uuidString)", isDirectory: true)
        let firstVault = base.appendingPathComponent("我的笔记", isDirectory: true)
        let secondVault = base.appendingPathComponent("工作笔记", isDirectory: true)
        try FileManager.default.createDirectory(at: firstVault, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: secondVault, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }

        let configURL = base.appendingPathComponent("obsidian.json")
        let config: [String: Any] = [
            "vaults": [
                "one": ["path": firstVault.path, "open": true],
                "two": ["path": secondVault.path, "open": false]
            ]
        ]
        let data = try JSONSerialization.data(withJSONObject: config)
        try data.write(to: configURL)

        let vaults = try ObsidianVaultRegistry(configURL: configURL).discover()

        #expect(vaults.count == 2)
        #expect(vaults.first?.name == "我的笔记")
        #expect(vaults.first?.url.standardizedFileURL.path == firstVault.standardizedFileURL.path)
    }

    @Test func Obsidian目录索引列出目录并支持搜索() throws {
        let vault = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-obsidian-index-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: vault.appendingPathComponent("技术/阅读", isDirectory: true),
            withIntermediateDirectories: true
        )
        try FileManager.default.createDirectory(
            at: vault.appendingPathComponent("Docker", isDirectory: true),
            withIntermediateDirectories: true
        )
        try FileManager.default.createDirectory(
            at: vault.appendingPathComponent("NAS", isDirectory: true),
            withIntermediateDirectories: true
        )
        try FileManager.default.createDirectory(
            at: vault.appendingPathComponent(".obsidian", isDirectory: true),
            withIntermediateDirectories: true
        )
        defer { try? FileManager.default.removeItem(at: vault) }

        let index = try ObsidianDirectoryIndex(vaultURL: vault)
        let allDirectories = index.items(matching: "")
        let searchResults = index.items(matching: "阅读")

        #expect(allDirectories.contains { $0.name == "根目录" })
        #expect(allDirectories.contains { $0.name == "Docker" })
        #expect(allDirectories.contains { $0.name == "NAS" })
        #expect(allDirectories.contains { $0.name == "阅读" && $0.relativePath == "技术/阅读" })
        #expect(!allDirectories.contains { $0.name == ".obsidian" })
        #expect(searchResults.map(\.relativePath) == ["技术/阅读"])
    }

    @Test func 文件导出成功提示立即打开复制成功走通知() {
        let fileURL = URL(fileURLWithPath: "/tmp/导出.md")
        let fileCompletion = ArticleExportCompletion.file(fileURL)
        let copyCompletion = ArticleExportCompletion.copied(
            title: "复制成功",
            body: "Markdown 已复制到剪贴板"
        )

        #expect(fileCompletion.presentation == .openPrompt(fileURL))
        #expect(
            copyCompletion.presentation == .notification(
                title: "复制成功",
                body: "Markdown 已复制到剪贴板"
            )
        )
    }

    @Test func 复制通知服务发送系统通知() async {
        let spy = ArticleExportNotificationSpy()
        let service = ArticleExportNotificationService(delivery: spy)

        await service.notifyCopySuccess("纯文本已复制到剪贴板")

        let requests = await spy.requests
        #expect(
            requests == [
                ArticleExportNotificationRequest(
                    title: "复制成功",
                    body: "纯文本已复制到剪贴板"
                )
            ]
        )
    }

    @Test func 导出菜单包含约定入口且不包含思源() {
        let titles = ArticleExportAction.allCases.map(\.title)

        #expect(titles.contains("Markdown"))
        #expect(titles.contains("HTML"))
        #expect(titles.contains("PDF"))
        #expect(titles.contains("Word"))
        #expect(titles.contains("纯文本"))
        #expect(titles.contains("EPUB"))
        #expect(titles.contains("Obsidian"))
        #expect(!titles.contains { $0.localizedCaseInsensitiveContains("siyuan") || $0.contains("思源") })
    }

    @MainActor
    private func 写入测试图片() throws -> URL {
        let image = NSImage(size: NSSize(width: 2, height: 2))
        image.lockFocus()
        NSColor.systemRed.setFill()
        NSRect(x: 0, y: 0, width: 2, height: 2).fill()
        image.unlockFocus()

        guard
            let tiff = image.tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let png = bitmap.representation(using: .png, properties: [:])
        else {
            throw CocoaError(.fileWriteUnknown)
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("storing-test-image-\(UUID().uuidString).png")
        try png.write(to: url)
        return url
    }

    private func 解压(_ archiveURL: URL, to directory: URL) throws -> (status: Int32, output: String) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return try 运行命令("/usr/bin/unzip", ["-q", "-o", archiveURL.path, "-d", directory.path])
    }

    private func 运行命令(_ executable: String, _ arguments: [String]) throws -> (status: Int32, output: String) {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = pipe
        process.standardError = pipe
        try process.run()
        process.waitUntilExit()
        let output = String(
            data: pipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""
        return (process.terminationStatus, output)
    }
}

private actor ArticleExportNotificationSpy: ArticleExportNotificationDelivering {
    private(set) var requests: [ArticleExportNotificationRequest] = []

    func deliver(_ request: ArticleExportNotificationRequest) async {
        requests.append(request)
    }
}
