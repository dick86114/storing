# macOS 正文导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 macOS 原生正文详情页提供 Markdown、HTML、PDF、Word、纯文本和 Obsidian 导出，并在第二阶段加入 EPUB。

**Architecture:** 新增独立的 `ArticleExport` 核心层，先把文章统一为 `ArticleExportDocument`，再由各格式渲染器生成文件。正文界面只负责选择格式、调用导出服务和展示结果；SiYuan 不进入界面和代码。

**Tech Stack:** Swift 6、SwiftUI、AppKit、WebKit、Foundation、Office Open XML、ZIP、XCTest/Swift Testing

**Spec:** `docs/superpowers/specs/2026-10-01-macos-article-export-design.md`

## Global Constraints

- 所有新增代码、注释、界面文案和测试名称使用中文。
- 不接入 SiYuan。
- 文件格式首期必须包含 Markdown、HTML、PDF、Word `.docx`、纯文本和 Obsidian。
- EPUB 作为第二阶段任务，不阻塞首期交付。
- 不把仅改扩展名的 HTML 或 RTF 当成 `.docx`。
- 文件写入使用 `NSSavePanel`；Obsidian 目录选择使用 `NSOpenPanel`。
- 导出取消不显示错误。
- 当前工作区已有用户未提交改动，本计划不自动提交 Git commit；仅提交明确要求的文件。

## Review Focus

- 正文只有 HTML 没有 Markdown 时，导出仍必须生成可读的 Markdown。
- 文章缺少标题、作者、发布时间或标签时，导出文件仍应可生成。
- 文件名包含 `/ : * ? " < > |` 或重复名称时，不能覆盖用户文件。
- 远程图片不可访问时，HTML、PDF 和 Obsidian 导出不应整体失败。
- Obsidian Vault 被移动或权限失效时，必须提示用户重新选择目录。

---

### Task 1: 导出文档模型与 Markdown 生成

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/ArticleExportModels.swift`
- Create: `apps/macos/QiankunjieMac/Core/Export/MarkdownArticleRenderer.swift`
- Test: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `ReaderArticle`、`ArticleDetail.contentMarkdown`、`ArticleDetail.contentHTML`
- Produces:
  - `struct ArticleExportDocument`
  - `enum ArticleExportFormat`
  - `struct MarkdownArticleRenderer`
  - `func render(_ document: ArticleExportDocument) -> String`
  - `func safeFileName(_ title: String, fallback: String) -> String`

- [ ] **Step 1: 写失败测试**

测试必须覆盖：

- frontmatter 包含 `title`、`author`、`source`、`url`、`published`、`saved`、`category` 和 `tags`
- HTML 正文转换后包含正文文本
- 空标题回退为 `未命名文章`
- 非法文件名字符被替换

- [ ] **Step 2: 运行测试确认失败**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS,arch=arm64' test -only-testing:QiankunjieMacTests/ArticleExportTests`

Expected: FAIL，导出模型或渲染器不存在。

- [ ] **Step 3: 实现文档模型与 Markdown 渲染**

`ArticleExportDocument` 保存标题、作者、来源、原文链接、发布时间、收藏时间、AI 摘要、分类、标签、Markdown 和 HTML。Markdown 优先使用已有 Markdown；缺失时从 HTML 提取正文并转换。

- [ ] **Step 4: 运行测试确认通过**

Run: 上一条测试命令。

Expected: PASS。

### Task 2: HTML 与纯文本导出

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/HTMLArticleRenderer.swift`
- Create: `apps/macos/QiankunjieMac/Core/Export/PlainTextArticleRenderer.swift`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `ArticleExportDocument`
- Produces:
  - `struct HTMLArticleRenderer`
  - `func render(_ document: ArticleExportDocument) -> String`
  - `struct PlainTextArticleRenderer`
  - `func render(_ document: ArticleExportDocument) -> String`

- [ ] **Step 1: 写失败测试**

测试 HTML 包含完整 `<!doctype html>`、标题、AI 摘要、正文和阅读样式。测试纯文本不包含 HTML 标签，并保留段落换行。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，HTML 或纯文本渲染器不存在。

- [ ] **Step 3: 实现两种渲染器**

HTML 使用自包含样式；纯文本使用安全的标签剥离和实体解码。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 3: PDF 导出

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/PDFArticleRenderer.swift`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `HTMLArticleRenderer`
- Produces:
  - `@MainActor final class PDFArticleRenderer`
  - `func render(_ document: ArticleExportDocument, to url: URL) async throws`

- [ ] **Step 1: 写失败测试**

测试导出临时 PDF，断言文件存在、大小大于 0、扩展名为 `.pdf`。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，PDF 渲染器不存在。

- [ ] **Step 3: 使用 WKWebView 生成 PDF**

加载导出 HTML，等待文档加载完成，再调用 `WKWebView.createPDF` 写入目标 URL。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 4: Word `.docx` 导出

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/DocxArticleRenderer.swift`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `ArticleExportDocument`
- Produces:
  - `struct DocxArticleRenderer`
  - `func render(_ document: ArticleExportDocument, to url: URL) throws`

- [ ] **Step 1: 写失败测试**

测试 `.docx` 可被 ZIP 解包，并包含 `[Content_Types].xml`、`_rels/.rels`、`word/document.xml`。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，Docx 渲染器不存在。

- [ ] **Step 3: 生成最小 OOXML 包**

在临时目录生成必需 XML 条目，再使用系统 ZIP 工具打包为目标 `.docx`。正文至少支持标题、段落、列表、引用、代码块和链接。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 5: Obsidian 导出

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/ObsidianExportSettings.swift`
- Create: `apps/macos/QiankunjieMac/Core/Export/ObsidianArticleExporter.swift`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `MarkdownArticleRenderer`
- Produces:
  - `struct ObsidianExportSettings`
  - `@MainActor final class ObsidianArticleExporter`
  - `func export(_ document: ArticleExportDocument) async throws -> URL`
  - `enum ObsidianConflictPolicy`

- [ ] **Step 1: 写失败测试**

测试目录写入、同名文件追加序号、Vault 未配置错误和非法文件名处理。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，Obsidian 导出器不存在。

- [ ] **Step 3: 实现目录配置与 Markdown 写入**

使用 `NSOpenPanel` 选择目录，路径写入 Keychain 或偏好存储；导出时写 `.md` 文件，并支持冲突策略。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 6: EPUB 导出

**Files:**
- Create: `apps/macos/QiankunjieMac/Core/Export/EPUBArticleRenderer.swift`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: `ArticleExportDocument`
- Produces:
  - `struct EPUBArticleRenderer`
  - `func render(_ document: ArticleExportDocument, to url: URL) throws`

- [ ] **Step 1: 写失败测试**

测试 EPUB ZIP 包含 `mimetype`、`META-INF/container.xml`、`OEBPS/content.opf` 和至少一个 XHTML 正文。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，EPUB 渲染器不存在。

- [ ] **Step 3: 实现最小 EPUB 包**

生成目录、元数据、导航和 XHTML 正文；图片首期保留远程引用。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 7: 正文导出入口

**Files:**
- Create: `apps/macos/QiankunjieMac/Features/Reader/ArticleExportMenu.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Reader/ArticleActionBar.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift`
- Modify: `apps/macos/QiankunjieMacTests/ReaderWebViewCoordinatorTests.swift`

**Interfaces:**
- Consumes: `ArticleExportDocument`、各渲染器、`ObsidianArticleExporter`
- Produces:
  - `struct ArticleExportMenu`
  - `@MainActor final class ArticleExportCoordinator`
  - `func export(_ format: ArticleExportFormat) async`

- [ ] **Step 1: 写失败 UI 行为测试**

测试菜单包含 Markdown、HTML、PDF、Word、纯文本和 Obsidian，不包含 SiYuan。

- [ ] **Step 2: 运行测试确认失败**

Expected: FAIL，导出菜单不存在。

- [ ] **Step 3: 接入工具栏与保存面板**

在正文工具栏加入导出图标和菜单。文件格式使用 `NSSavePanel`，Obsidian 使用目录导出流程。

- [ ] **Step 4: 运行测试确认通过**

Expected: PASS。

### Task 8: 全量验证与文档

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-macos-article-export-design.md`
- Modify: `apps/macos/QiankunjieMacTests/ArticleExportTests.swift`

**Interfaces:**
- Consumes: 前序任务全部导出器和 UI 入口。
- Produces: 可交付的导出功能和验证记录。

- [ ] **Step 1: 运行 macOS 完整测试**

Run: `bash apps/macos/scripts/test.sh`

Expected: PASS。

- [ ] **Step 2: 手工验收**

依次导出 Markdown、HTML、PDF、Word、纯文本到临时目录，确认文件可打开；导出一次到 Obsidian 测试 Vault，确认 Markdown 文件生成。

- [ ] **Step 3: 记录限制**

确认文档说明：图片本地化、自定义 frontmatter 和 EPUB 图片打包属于后续增强。

## Self-Review

- 规格覆盖：文件格式、Obsidian、错误处理、测试和验收标准均有对应任务。
- 类型一致性：`ArticleExportDocument` 作为所有渲染器的统一输入。
- 禁止项：SiYuan 未进入任务。
- 风险点：PDF 和 DOCX 依赖系统渲染或 ZIP 工具，测试任务已覆盖可打开性与包结构。
