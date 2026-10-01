# macOS 正文导出设计

日期：2026-10-01

## 目标

在 macOS 原生客户端正文详情页提供统一导出入口，让用户把当前文章导出为通用文件格式，或发送到 Obsidian。导出内容保留文章元数据、AI 摘要、分类和标签，图片在支持预览的格式中保持可访问。

## 范围

首期实现：

- Markdown
- HTML
- PDF
- Word（标准 `.docx`）
- 纯文本
- Obsidian
- 复制 Markdown
- 复制纯文本

第二阶段：

- EPUB
- Word 和 EPUB 图片下载嵌入
- 自定义 frontmatter 模板
- 按分类或标签自动生成目录

明确不做：

- SiYuan 集成
- Notion、Bear、Craft 等第三方笔记集成
- 云端导出任务
- 服务端保存导出历史

## 用户体验

正文工具栏增加一个“导出”图标按钮，使用 macOS 菜单呈现：

- 文件格式：Markdown、HTML、PDF、Word、纯文本
- 笔记应用：Obsidian
- 复制：复制 Markdown、复制纯文本

文件格式使用系统保存面板选择文件名和目录。Obsidian 导出前显示配置弹窗，标题默认带入文章标题且可修改，保管库每次都可选择，路径默认为保管库根目录或库内子目录。

导出过程中显示轻量进度状态。文件导出成功后弹窗只提供“立即打开”和“取消”；复制成功通过系统通知提示。失败时显示可操作的中文错误，不使用统一的“服务不可用”提示。

## 内容模型

新增统一的 `ArticleExportDocument`：

- 标题
- 作者
- 来源
- 原文链接
- 发布时间
- 收藏或抓取时间
- AI 摘要
- 分类
- 标签
- Markdown 正文
- HTML 正文
- 图片引用

正文来源优先级：

1. 文章已有 `contentMarkdown`
2. 文章已有 `contentHTML`
3. 阅读器生成的 HTML 回退正文

Markdown 导出使用 `contentMarkdown`。缺失时从清洗后的 HTML 转换。HTML 导出沿用阅读器展示的正文 HTML，并包装为可独立打开的完整文档。

## 文件格式

### Markdown

- 输出 `.md`
- 默认写入 YAML frontmatter
- 保留标题层级、列表、引用、代码块、链接和图片
- 远程图片继续引用原地址
- Markdown 正文缺失图片但 HTML 正文含图片时，自动补充 HTML 图片链接；相对地址以原文链接为基准解析
- 文件名经过非法字符清理，保留中文

### HTML

- 输出自包含 `.html`
- 内嵌阅读样式
- 图片使用远程地址
- 元信息与正文分区明确
- 可直接用浏览器打开

### PDF

- 使用 `WKWebView.createPDF`
- 使用导出 HTML 渲染，避免重复排版逻辑
- 保留标题、AI 摘要、元数据和正文
- 图片加载失败不阻止 PDF 生成

### Word

- 输出标准 `.docx`，不使用仅改扩展名的文件
- 生成最小 Office Open XML 包
- 包含标题、元数据、AI 摘要和正文
- 首期支持标题、段落、列表、引用、代码块和链接
- 复杂排版允许降级，但文档必须能被 Word、Pages 和 WPS 打开
- 下载正文图床图片并嵌入 `word/media`；远程图片不可访问时跳过，但不能阻止文档生成
- Markdown 图片行原位嵌入；仅存在于 HTML 正文的图片自动追加到文末，避免漏图

### 纯文本

- 输出 `.txt`
- 去除 HTML 标签和无关导航内容
- 保留标题、元数据、AI 摘要、正文段落和列表

### EPUB

已实现：

- 输出标准 `.epub`
- 包含封面、目录、元数据和正文
- 图片本地化到 EPUB 包内
- HTML-only 图片也会加入 manifest，并在 Markdown 图片插槽不足时追加到章节末尾
- 适合电子书阅读器和长期归档

## Obsidian

使用文件夹集成，不要求安装第三方插件。

流程：

1. 导出前弹出配置窗口。
2. 标题默认使用文章标题并允许修改。
3. 应用读取 Obsidian 本机配置，自动列出已登记的保管库；保留“选择其他保管库”作为回退。
4. 路径直接在所选保管库的目录树中选择，支持搜索；默认根目录，不强制打开访达。
5. 导出时生成 Markdown 文件并写入目标目录。
6. 同名文件自动追加序号，不覆盖已有笔记。

默认 frontmatter：

```yaml
---
title: 文章标题
author: 作者
source: 来源
url: 原文链接
published: 发布时间
saved: 收藏时间
category: 分类
tags:
  - 标签
summary: AI 摘要
---
```

## 架构

新增模块 `ArticleExport`：

- `ArticleExportDocument`
- `ArticleExportFormat`
- `ArticleExportService`
- `MarkdownExporter`
- `HTMLExporter`
- `PDFExporter`
- `DocxExporter`
- `PlainTextExporter`
- `EPUBExporter`
- `ObsidianExporter`

界面层只负责收集导出意图和展示结果，不直接拼装文件内容。导出器各自负责格式生成和错误映射。

系统能力使用：

- `NSSavePanel`：选择文件保存位置
- `NSOpenPanel`：选择 Obsidian 目录
- `WKWebView`：HTML 渲染与 PDF 生成
- `FileManager`：文件写入和目录管理
- `Foundation`：JSON、XML、压缩包源码生成
- Keychain：保存 Obsidian 目录书签

## 错误处理

错误分类：

- 无正文内容
- 文件写入失败
- 目标目录不可访问
- 文件名冲突
- PDF 渲染失败
- Word 包生成失败
- Obsidian 目录未配置
- 导出被用户取消

取消不算错误。其他错误必须显示具体原因和下一步操作。

## 测试

单元测试：

- Markdown frontmatter 生成
- 文件名清理
- HTML 独立文档包装
- HTML 到纯文本转换
- DOCX 包结构和核心 XML
- EPUB 包结构和目录
- Obsidian 文件写入与同名策略
- 元数据字段映射
- Word 和 EPUB 图片嵌入与 package manifest

集成测试：

- PDF 生成非空且页数大于 0
- Word 文件可被 ZIP 解析并包含必要条目
- HTML 在 WebKit 中可加载
- Markdown 与 Obsidian 导出内容一致

验收标准：

- 正文页可从一个入口导出全部首期格式
- Markdown、HTML、PDF、Word、纯文本均可正常打开
- Obsidian 导出无需插件
- 导出内容包含文章元数据、AI 摘要、分类和标签
- 不存在正文时给出明确提示
- SiYuan 不出现在界面中
