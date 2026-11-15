#if DEBUG
import Foundation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieLibrary
import QiankunjieReader
import QiankunjieUpdating
import QiankunjieCore

/// UI Lab 的所有内容都在进程内固定；不会写入用户数据或请求生产服务。
@MainActor
enum UILabFixtures {
    static let preferenceSuiteName = "com.idickies.storing.macos.uilab.preferences.\(UUID().uuidString)"
    static let preferences = UserDefaults(suiteName: preferenceSuiteName)!
    static let updateService = UILabFixtureUpdateService()
    static let updateCompletionNotice = UpdateCompletionNotice(
        version: "0.2.0",
        previousVersion: "0.1.0",
        notes: """
        ## 新增
        - 更新完成后展示当前版本与完整更新日志
        - 首页版本号可直接回看更新内容

        ## 修复
        - 修复部分长日志在深色主题下对比度不足的问题
        """,
        releaseURL: URL(string: "https://github.com/dick86114/storing/releases/tag/macos-v0.2.0")!,
        publishedAt: ISO8601DateFormatter().date(from: "2026-10-20T12:00:00Z")
    )
    static let currentVersionNotice = UpdateCompletionNotice.currentVersion(
        version: "0.2.0",
        notes: """
        修复：采集失败导致阻塞收件箱的问题
        修复：检测更新不显示更新日志的问题
        优化：增加更新日志缓存
        """
    )
    static let refreshedCurrentVersionNotes = """
    ## 修复
    - 采集失败导致阻塞收件箱的问题
    - 检测更新不显示更新日志的问题

    ## 优化
    - 增加更新日志缓存
    - 当前版本窗口支持手动刷新更新日志
    """

    static let user = AuthenticatedUser(
        id: 9001,
        username: "uilab-user",
        role: "user",
        status: "active"
    )

    static let article = ArticleCard(
        id: 1001,
        title: "macOS 原生阅读器长文排版夹具",
        author: "UI Lab",
        source: "乾坤戒设计规范",
        originalURL: "https://example.com/ui-lab/article",
        publicID: "uilab-article-1001",
        coverImage: nil,
        publishTime: ISO8601DateFormatter().date(from: "2026-09-30T09:00:00Z"),
        createdAt: ISO8601DateFormatter().date(from: "2026-09-30T09:00:00Z"),
        aiSummary: "用于检查标题、摘要、来源、标签和正文排版的可重复夹具。",
        aiCategory: "产品设计",
        aiTags: ["macOS", "阅读器", "UI Lab"],
        isFavorited: true,
        deepAnalysis: DeepAnalysisSummary(
            hasDeepAnalysis: true,
            status: "succeeded",
            version: 2,
            generatedAt: ISO8601DateFormatter().date(from: "2026-11-15T02:10:00Z"),
            stale: false
        )
    )

    static let categoryFixtures = [
        ArticleCategory(
            id: 1,
            name: "待整理",
            articleDescription: "AI 无法可靠判断，或暂时不适合归入其他分类的文章。",
            color: "#6B7088",
            sortOrder: 0,
            isSystem: true
        ),
        ArticleCategory(
            id: 2,
            name: "工作",
            articleDescription: "项目推进、协作沟通和产品决策相关文章。",
            includeExamples: ["产品需求评审", "跨团队项目计划"],
            excludeExamples: ["个人学习笔记"],
            color: "#5B74E8",
            sortOrder: 10
        ),
        ArticleCategory(
            id: 3,
            name: "技术",
            articleDescription: "工程实现、架构设计和稳定性相关文章。",
            includeExamples: ["架构设计", "故障复盘"],
            excludeExamples: ["团队管理"],
            color: "#39A06D",
            sortOrder: 20
        ),
        ArticleCategory(
            id: 4,
            name: "学习",
            articleDescription: "课程、书籍和长期知识积累。",
            includeExamples: ["课程笔记", "读书摘要"],
            excludeExamples: ["工作项目记录"],
            color: "#3FA5B4",
            sortOrder: 30
        ),
        ArticleCategory(
            id: 5,
            name: "生活",
            articleDescription: "健康、旅行、家庭和日常兴趣。",
            includeExamples: ["旅行攻略", "健康计划"],
            excludeExamples: ["业务复盘"],
            color: "#C97749",
            sortOrder: 40
        ),
        ArticleCategory(
            id: 6,
            name: "旧项目",
            articleDescription: "已结束项目的历史资料，保留用于追溯。",
            includeExamples: ["已结项归档", "历史交付记录"],
            excludeExamples: ["当前项目计划"],
            color: "#9868B5",
            sortOrder: 50,
            isActive: false
        ),
    ]

    static let categoryRecentIDs = [2, 3]
    static let readerCategories = categoryFixtures
    static let categoryService = FixtureCategoryCatalogService(categories: readerCategories)

    static let categoryCatalog = makeCategoryCatalog()
    static let categoryCreateCancelCatalog = makeCategoryCatalog()
    static let readerArticleCache = ReaderArticleCache(
        directoryURL: FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "StoringUILab-\(UUID().uuidString)",
                isDirectory: true
            )
    )
    static let readerWebCache = ReaderWebCache(identifier: UUID())

    private static func makeCategoryCatalog() -> CategoryCatalogModel {
        let recentStore = CategoryRecentStore(defaults: preferences)
        recentStore.save(categoryRecentIDs, userID: user.id)
        let catalog = CategoryCatalogModel(
            service: categoryService,
            recentStore: recentStore
        )
        catalog.prepareUser(userID: user.id)
        return catalog
    }

    static let articles = [
        article,
        ArticleCard(
            id: 1002,
            title: "三栏资料库紧凑列表压力样例",
            source: "固定样例",
            aiSummary: "验证较长标题和多行摘要不会被裁切到不可读。",
            aiTags: ["资料库"],
            deepAnalysis: DeepAnalysisSummary(
                status: "running",
                version: 1,
                stale: false
            )
        ),
        ArticleCard(
            id: 1003,
            title: "深度报告失败的样例",
            source: "固定样例",
            aiSummary: "用于检查失败状态图标和提示文案，不会访问真实任务。",
            aiTags: ["状态"],
            deepAnalysis: DeepAnalysisSummary(
                status: "failed",
                version: 1,
                stale: false,
                errorCode: "AI_TIMEOUT"
            )
        ),
    ]

    static let articleDetail = ArticleDetail(
        id: article.id,
        title: article.title,
        author: article.author,
        source: article.source,
        originalURL: article.originalURL,
        publicID: article.publicID,
        publishTime: article.publishTime,
        createdAt: article.createdAt,
        aiSummary: article.aiSummary,
        aiCategory: article.aiCategory,
        aiTags: article.aiTags,
        isFavorited: true,
        isPublished: true,
        contentHTML: readerHTML
    )

    static let readerCategoryUnavailableDetail = ArticleDetail(
        id: article.id,
        title: article.title,
        author: article.author,
        source: article.source,
        originalURL: article.originalURL,
        publicID: article.publicID,
        publishTime: article.publishTime,
        createdAt: article.createdAt,
        aiSummary: article.aiSummary,
        aiCategory: article.aiCategory,
        aiTags: article.aiTags,
        category: readerCategories.first { $0.id == 3 },
        isFavorited: true,
        isArchived: true,
        isPublished: true,
        contentHTML: readerHTML
    )

    static let deepAnalysisArticle = DeepAnalysisArticleContext(
        title: "Mac 拖废纸篓卸载 = 白卸？残留文件悄悄占了好几个 G",
        author: "小麦",
        source: "苹果黑科技",
        publishTime: ISO8601DateFormatter().date(from: "2026-11-13T07:49:00Z"),
        coverImageURL: nil
    )

    static let deepAnalysisSummary = DeepAnalysisSummary(
        hasDeepAnalysis: true,
        status: "succeeded",
        version: 3,
        generatedAt: ISO8601DateFormatter().date(from: "2026-11-15T03:08:00Z"),
        stale: false
    )

    static let deepAnalysisResponse = DeepAnalysisResponse(
        reportRecord: deepAnalysisRecord,
        summary: deepAnalysisSummary
    )

    static let deepAnalysisInlineDetail = ArticleDetail(
        id: article.id,
        title: deepAnalysisArticle.title,
        author: deepAnalysisArticle.author,
        source: deepAnalysisArticle.source,
        originalURL: article.originalURL,
        publicID: article.publicID,
        publishTime: deepAnalysisArticle.publishTime,
        createdAt: article.createdAt,
        aiSummary: "用一篇 Mac 卸载工具文章验证深度报告内嵌阅读体验。",
        aiCategory: "产品设计",
        aiTags: ["macOS", "卸载", "UI Lab"],
        isFavorited: true,
        isPublished: true,
        contentHTML: readerHTML
    )

    static let deepAnalysisRecord: DeepAnalysisReportRecord = {
        let report = try! JSONDecoder.qiankunjie.decode(
            DeepAnalysisReport.self,
            from: Data(deepAnalysisReportJSON.utf8)
        )
        return DeepAnalysisReportRecord(
            version: 3,
            reportJson: report,
            reportMarkdown: nil,
            providerSnapshot: "custom",
            modelSnapshot: "mimo-v2.6-flash",
            promptTokens: 2124,
            completionTokens: 3056,
            totalTokens: 5180,
            contentTruncated: false,
            attempts: 1,
            durationMs: 80_000,
            generatedAt: ISO8601DateFormatter().date(from: "2026-11-15T03:08:00Z")
        )
    }()

    private static let deepAnalysisReportJSON = """
    {
      "executiveSummary": "这篇文章讨论 Mac 上把应用拖进废纸篓并不等于彻底卸载。作者认为缓存、偏好设置和后台启动项会继续占用空间，并推荐使用免费开源的 Peel 逐条扫描残留文件。文章给出了安装方式、权限要求、保护区范围和不可恢复操作，适合希望手动审阅清理项的用户。",
      "coreArguments": [
        {"claim": "拖进废纸篓只删除应用本体，不会清理全部关联文件", "evidence": "缓存、设置和后台启动项仍可能留在资源库中，文章用白卸概括这种落差", "quoteAnchor": "开头问题段"},
        {"claim": "Peel 把软件和残留文件一起列出，并解释每个文件的归属理由", "evidence": "它根据软件标识、签名团队和 Homebrew 记录判断文件归属，低把握文件默认不勾选", "quoteAnchor": "功能介绍段"},
        {"claim": "删除策略偏保守，移入废纸篓后仍可通过 History 恢复", "evidence": "文章反复强调不直接清空，真正释放空间还需要用户手动清理废纸篓", "quoteAnchor": "删除策略段"},
        {"claim": "工具设置了明确的系统门槛和权限门槛", "evidence": "仅支持 macOS 26 及以上，完全磁盘访问权限决定扫描是否完整", "quoteAnchor": "安装与权限段"},
        {"claim": "敏感目录被划入保护区，降低误删风险", "evidence": "iCloud、钥匙串、密钥、邮件、照片图库和 iPhone 备份不会被移走", "quoteAnchor": "保护区段"}
      ],
      "reasoningChain": [
        "先指出拖废纸篓卸载后仍会留下缓存、设置和启动项，建立问题背景",
        "引入 Peel，说明它会扫描残留并给出每个文件的归属理由",
        "强调低置信度文件默认不勾选，选中项只移入废纸篓，形成可逆流程",
        "补充 macOS 26 门槛、完全磁盘访问权限和保护区，界定可用范围",
        "最后提醒四类 History 无法恢复的操作，要求用户逐条审阅"
      ],
      "keyFacts": [
        {"fact": "Peel 仅支持 macOS 26 及以上系统，更早系统无法安装", "basis": "source", "quoteAnchor": "安装说明"},
        {"fact": "Peel 是免费开源项目，许可证为 GPL-3.0 或更高版本，仓库约 450 Star，当前版本 1.3.0", "basis": "source", "quoteAnchor": "项目信息段"},
        {"fact": "安装方式包括 Homebrew cask 和 GitHub Releases 的 dmg", "basis": "source", "quoteAnchor": "安装方式段"},
        {"fact": "没有付费版、没有广告、不用注册账号", "basis": "source", "quoteAnchor": "官方说明段"},
        {"fact": "卸载时只把文件移入废纸篓，需要用户自行清空才真正释放空间", "basis": "source", "quoteAnchor": "删除流程段"},
        {"fact": "残留文件有时能占好几个 G 属于概括性表述，文章没有给出具体实测数据", "basis": "inference", "quoteAnchor": "开头段"}
      ],
      "viewpoints": [
        {"stance": "support", "summary": "逐条解释归属理由比一键清理更适合普通用户", "reasoning": "可逆流程和低置信度默认不勾选降低了误删风险，也保留了对文件的控制感"},
        {"stance": "conditional", "summary": "工具价值取决于系统版本和用户是否愿意逐条审阅", "reasoning": "macOS 26 门槛排除了旧设备，完全磁盘访问权限和手动勾选又提高了使用成本"},
        {"stance": "oppose", "summary": "占好几个 G 的说法缺少实测支撑", "reasoning": "文章没有给出典型应用的残留体积、文件数量和对比样本，读者难以判断收益是否普遍"},
        {"stance": "conditional", "summary": "History 可恢复不代表所有操作都能撤回", "reasoning": "Homebrew 卸载清理和重置隐私权限等四类操作无法恢复，仍需要用户提前理解风险"}
      ],
      "risks": [
        "低置信度文件如果被误勾选，仍可能移走其他应用共用的文件",
        "四类 History 无法恢复的操作需要用户逐条确认，不能把可恢复当成绝对安全",
        "旧系统用户无法安装，文章的工具推荐并不覆盖全部 Mac 用户",
        "不给完全磁盘访问权限时扫描不完整，清理效果可能低于预期",
        "第三方网站和商店可能存在仿冒收费版本，必须从官方渠道下载"
      ],
      "actions": [
        {"action": "先确认 Mac 是否运行 macOS 26 或更新版本", "condition": "准备安装 Peel 前"},
        {"action": "只从 GitHub Releases、官网或 Homebrew 获取安装包", "condition": "下载和安装时"},
        {"action": "在系统设置里授予完全磁盘访问权限", "condition": "希望扫描更完整时"},
        {"action": "逐条阅读残留文件的归属理由，取消不确认的勾选", "condition": "执行卸载前"},
        {"action": "确认不需要恢复后，再到访达清空废纸篓", "condition": "完成 Peel 清理后"}
      ],
      "questions": [
        "典型应用卸载后残留文件的体积分布是什么样的？",
        "Peel 对没有明显签名或 Homebrew 记录的软件识别准确率如何？",
        "macOS 26 以下是否有同等安全机制的替代方案？",
        "四类不可恢复操作的完整清单和触发条件在哪里查看？"
      ],
      "readingPath": [
        "先读开头问题段，理解拖废纸篓不等于彻底卸载",
        "再读功能介绍，弄清楚扫描、理由和可回滚机制",
        "接着确认系统门槛和安装方式，判断自己的机器是否适用",
        "重点阅读保护区和四类不可恢复操作",
        "最后结合自己的清理习惯决定是否采用"
      ],
      "aiWriting": {
        "score": 68,
        "summary": "文章结构工整、段落长度接近，抽象概括较多；同时包含具体版本、安装命令和操作步骤，更像是 AI 辅助整理或人机协作，而不是完全自动生成。",
        "signals": [
          {"label": "段落长度过于均衡", "detail": "多个段落的长度和收尾方式接近，转折词重复出现。", "leaning": "ai"},
          {"label": "抽象概括偏多", "detail": "频繁使用安全性、可逆性和适用性等概括词。", "leaning": "ai"},
          {"label": "包含具体版本与命令", "detail": "给出了 1.3.0、macOS 26 和 brew 安装命令。", "leaning": "human"},
          {"label": "引用来源较泛化", "detail": "多次转述官网和仓库说明，但没有逐条给出链接。", "leaning": "neutral"}
        ]
      }
    }
    """

    static let authModel = AuthModel(
        repository: AuthRepository(
            client: NoNetworkAuthClient(),
            store: MemorySessionStore()
        )
    )

    static let aiSettingsModel: AiSettingsModel = {
        let model = AiSettingsModel(repository: authModel.repository)
        model.configureForPreview(
            settings: UserAiSettings(
                provider: "deepseek",
                model: "deepseek-chat",
                baseUrl: "https://api.deepseek.com/v1",
                apiKeyConfigured: true,
                apiKeyLast4: "9F2A",
                apiKeyUpdatedAt: "2026-10-20T08:00:00.000Z",
                autoTriggerOnArchive: true,
                updatedAt: "2026-10-20T08:00:00.000Z"
            ),
            models: aiModelOptions,
            jobs: aiJobs,
            usage: aiUsage,
            totalJobs: 27,
            previewJobsByPage: aiJobPages
        )
        return model
    }()

    private static let aiModelOptions = [
        AiModelOption(id: "deepseek-chat", name: "DeepSeek Chat"),
        AiModelOption(id: "deepseek-reasoner", name: "DeepSeek Reasoner"),
        AiModelOption(id: "deepseek-coder", name: "DeepSeek Coder"),
        AiModelOption(id: "Qwen/Qwen3-32B", name: "Qwen 3 32B"),
        AiModelOption(id: "moonshot-v1-32k", name: "Moonshot 32K"),
        AiModelOption(id: "glm-4-flash", name: "GLM-4 Flash"),
        AiModelOption(id: "MiniMax-Text-01", name: "MiniMax Text 01"),
        AiModelOption(id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B"),
    ]

    private static let aiJobPages: [Int: [AiJobSummary]] = [
        1: (0..<10).map { makeAiJob($0) },
        2: (10..<20).map { makeAiJob($0) },
        3: (20..<27).map { makeAiJob($0) },
    ]

    private static let aiJobs = aiJobPages[1] ?? []

    private static let aiUsage = AiGenerationUsageSummary(
        totalJobs: 27,
        succeededJobs: 24,
        failedJobs: 3,
        queuedJobs: 0,
        runningJobs: 0,
        promptTokens: 48_620,
        completionTokens: 12_940,
        totalTokens: 61_560,
        averageDurationMs: 1_680,
        byType: [
            AiGenerationTypeUsageSummary(
                callType: "summary_and_category",
                jobs: 16,
                totalTokens: 38_240
            ),
            AiGenerationTypeUsageSummary(
                callType: "summary",
                jobs: 8,
                totalTokens: 17_560
            ),
            AiGenerationTypeUsageSummary(
                callType: "mcp_summary",
                jobs: 3,
                totalTokens: 5_760
            ),
        ],
        daily: (0..<14).map { index in
            let day = 15 + index
            let jobs = [1, 2, 1, 3, 2, 4, 2, 1, 3, 5, 2, 4, 3, 2][index]
            return AiGenerationDailyUsageSummary(
                date: String(format: "2026-10-%02d", day),
                jobs: jobs,
                succeededJobs: max(0, jobs - (index.isMultiple(of: 6) ? 1 : 0)),
                failedJobs: index.isMultiple(of: 6) ? 1 : 0,
                totalTokens: jobs * 2_240
            )
        }
    )

    private static func makeAiJob(_ index: Int) -> AiJobSummary {
        let titles = [
            "macOS 原生应用的交互性能优化清单",
            "从信息架构到可访问性的设置页设计",
            "为什么列表虚拟化对长文档仍然重要",
            "SwiftUI 状态管理与异步任务调度实践",
            "构建可靠的 AI 内容生成任务队列",
            "阅读器缓存命中率和首屏速度复盘",
            "服务端聚合图表的数据建模思路",
            "GitHub API 限流与令牌配置指南",
            "文章归档后的自动分类与人工复核",
            "本地优先应用的离线体验设计",
        ]
        let callTypes = ["summary_and_category", "summary", "mcp_summary"]
        let statuses = [2, 7, 17].contains(index) ? "failed" : "succeeded"
        let callType = callTypes[index % callTypes.count]
        let totalMinutes = 12 * 60 + 58 - index * 5
        let hour = totalMinutes / 60
        let minute = totalMinutes % 60
        let createdAt = String(format: "2026-10-28T%02d:%02d:00.000Z", hour, minute)
        let promptTokens = 1_240 + index * 130
        let completionTokens = 320 + index * 42

        return AiJobSummary(
            id: 126 - index,
            articleId: 8_420 - index * 17,
            articleTitle: titles[index % titles.count],
            triggerType: callType == "mcp_summary" ? "mcp_summary" : "archive",
            callType: callType,
            includeCategory: callType == "summary_and_category",
            status: statuses,
            errorCode: statuses == "failed" ? "AI_TIMEOUT" : nil,
            errorMessage: statuses == "failed" ? "模型服务响应超时，请稍后重试" : nil,
            provider: "deepseek",
            model: index.isMultiple(of: 3) ? "deepseek-reasoner" : "deepseek-chat",
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
            createdAt: createdAt,
            startedAt: createdAt,
            finishedAt: createdAt,
            durationMs: 920 + index * 183
        )
    }

    static let libraryModel = LibraryModel(
        repository: FixtureLibraryRepository(
            state: .content,
            articles: articles
        ),
        cache: EmptyLibraryCache(),
        userID: user.id
    )

    static let collectModel = CollectModel(
        repository: FixtureCollectRepository(jobs: collectJobs),
        userID: user.id,
        initialJobs: collectJobs
    )

    static let appModel: AppModel = {
        let model = AppModel(
            authModel: authModel,
            libraryModel: libraryModel,
            collectRepository: FixtureCollectRepository(jobs: collectJobs),
            shortcutDefaults: preferences,
            readerPositionStore: MemoryReaderPositionStore(),
            readerArticleCache: readerArticleCache,
            readerWebCache: readerWebCache,
            categoryCatalog: categoryCatalog
        )
        model.user = user
        model.destination = .inbox
        return model
    }()

    static func libraryModel(for state: FixtureLibraryState) -> LibraryModel {
        LibraryModel(
            repository: FixtureLibraryRepository(
                state: state,
                articles: articles
            ),
            cache: EmptyLibraryCache(),
            userID: user.id
        )
    }

    static let readerHTML = """
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        :root { color-scheme: light dark; font: 16px/1.75 -apple-system, "PingFang SC", sans-serif; }
        body { margin: 0 auto; padding: 32px 24px 64px; max-width: 720px; }
        h1 { line-height: 1.25; } h2 { margin-top: 36px; }
        pre { background: rgba(127,127,127,.12); padding: 14px; border-radius: 8px; overflow: auto; }
        table { width: 1200px; border-collapse: collapse; } th, td { border: 1px solid gray; padding: 10px; }
        blockquote { margin: 0; padding-left: 18px; border-left: 4px solid rgba(127,127,127,.4); }
      </style>
    </head>
    <body>
      <h1>阅读器端到端固定正文</h1>
      <p>这一段验证中文换行、长英文串与链接边界：UI-Lab-deterministic-reader-fixture-with-a-very-long-token。</p>
      <blockquote><p>固定引用用于检查左侧标记与缩进。</p></blockquote>
      <h2>代码与表格</h2>
      <pre><code>let scenario = "reader"</code></pre>
      <div style="overflow-x:auto"><table><thead><tr><th>场景</th><th>验收点</th></tr></thead><tbody><tr><td>阅读器</td><td>宽表可横向滚动，不撑破页面</td></tr></tbody></table></div>
    </body>
    </html>
    """

    static let collectJobs: [CollectJob] = {
        let payload = """
        [
          {"id":7000,"url":"https://example.com/collect-queued","normalized_url":"https://example.com/collect-queued","status":"pending","stage":"排队等待抓取","article_id":null,"title":"排队中的固定采集任务","error_details":[]},
          {"id":7001,"url":"https://example.com/collect-running","normalized_url":"https://example.com/collect-running","status":"running","stage":"正在提取正文","article_id":null,"title":"运行中的固定采集任务","error_details":[]},
          {"id":7002,"url":"https://example.com/collect-complete","normalized_url":"https://example.com/collect-complete","status":"completed","stage":"finished","article_id":1001,"title":"已完成的固定采集任务","error_details":[]},
          {"id":7003,"url":"https://example.com/collect-failed","normalized_url":"https://example.com/collect-failed","status":"failed","stage":"failed","article_id":null,"title":"失败的固定采集任务","error":"fixture timeout","error_summary":"内容提取超时","error_details":["fixture timeout"],"error_hint":"重试时使用同一个固定夹具"}
        ]
        """
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            let jobs = try decoder.decode([CollectJob].self, from: Data(payload.utf8))
            precondition(!jobs.isEmpty, "UI Lab 采集任务夹具不能为空")
            return jobs
        } catch {
            fatalError("UI Lab 采集任务夹具解码失败：\(error)")
        }
    }()

    static var runningCollectJob: CollectJob {
        guard let job = collectJobs.first(where: { $0.status == "running" }) else {
            fatalError("UI Lab 采集任务夹具缺少运行中任务")
        }
        return job
    }
}

enum FixtureLibraryState: Sendable {
    case content
    case empty
    case loading
    case offline
}

private final class FixtureLibraryRepository: LibraryLoading, @unchecked Sendable {
    private let state: FixtureLibraryState
    private let articles: [ArticleCard]

    init(state: FixtureLibraryState) {
        self.state = state
        self.articles = []
    }

    init(state: FixtureLibraryState, articles: [ArticleCard]) {
        self.state = state
        self.articles = articles
    }

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        switch state {
        case .content:
            return ArticleListPage(
                articles: self.articles,
                total: articles.count,
                page: 1,
                perPage: 20,
                totalPages: 1
            )
        case .empty:
            return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 1)
        case .loading:
            try? await Task.sleep(for: .seconds(30))
            return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 1)
        case .offline:
            throw AppError.network
        }
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 1, favorites: 1, archive: 0, published: 1)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        [LibrarySource(source: "乾坤戒设计规范", count: 1, latestCreatedAt: nil)]
    }

}

private struct FixtureCollectRepository: CollectServicing {
    private let jobs: [CollectJob]

    init(jobs: [CollectJob]) {
        self.jobs = jobs
    }

    func submit(url: URL) async throws -> CollectJob {
        // UI Lab 保持提交中状态，便于人工验收取消入口；Release 构建不包含该夹具。
        try await Task.sleep(for: .seconds(30))
        return jobs.first { $0.status == "running" } ?? jobs.first!
    }

    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        CollectJobPage(jobs: jobs, total: jobs.count, hasMore: false)
    }

    func job(id: Int) async throws -> CollectJob? {
        jobs.first { $0.id == id }
    }

    func retry(id: Int) async throws -> CollectJob {
        jobs.first { $0.status == "running" } ?? jobs.first!
    }

    func delete(id: Int) async throws -> Bool {
        true
    }

    func clearFinished() async throws -> Int {
        2
    }
}

private struct NoNetworkAuthClient: AuthClient {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func logout(refreshToken: String) async throws {
        throw AppError.network
    }

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.network
    }
}

private struct MemorySessionStore: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}

private final class MemoryReaderPositionStore: ReaderPositionStoring, @unchecked Sendable {
    private var states: [Int: Data] = [:]
    private let lock = NSLock()

    func readingState(articleID: Int) -> Data? {
        lock.withLock { states[articleID] }
    }

    func save(_ state: Data, articleID: Int) {
        lock.withLock { states[articleID] = state }
    }

    func remove(articleID: Int) {
        lock.withLock { _ = states.removeValue(forKey: articleID) }
    }

    func prepareUser(userID: Int?) {
        lock.withLock { states.removeAll() }
    }
}

actor UILabReaderClient: ReaderNetworkClient {
    private var detail: ArticleDetail
    private let categories: [ArticleCategory]
    private let categoryService: FixtureCategoryCatalogService?
    private let deepAnalysisResponse: DeepAnalysisResponse?

    init(
        detail: ArticleDetail,
        categories: [ArticleCategory],
        categoryService: FixtureCategoryCatalogService? = nil,
        deepAnalysisResponse: DeepAnalysisResponse? = nil
    ) {
        self.detail = detail
        self.categories = categories
        self.categoryService = categoryService
        self.deepAnalysisResponse = deepAnalysisResponse
    }

    func articleDetail(_ selection: ReaderSelection) async throws -> ArticleDetail {
        detail
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        detail = 更新详情(isFavorited: true)
        return ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int, categoryID: Int?) async throws -> ReaderArchiveResult {
        detail = 更新详情(isArchived: true, categoryID: categoryID)
        return ReaderArchiveResult(isArchived: true, category: detail.category)
    }

    func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        detail = 更新详情(isArchived: false)
        return ReaderArchiveResult(isArchived: false)
    }

    func publish(articleID: Int) async throws -> ReaderPublicationResult {
        detail = 更新详情(isPublished: true)
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        detail = 更新详情(isPublished: false)
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        ReaderRefetchResult(hasHTML: true)
    }

    func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        ReaderAIResult(ok: true)
    }

    func submitDeepAnalysis(articleID: Int) async throws -> DeepAnalysisResponse {
        DeepAnalysisResponse(report: nil, summary: DeepAnalysisSummary(status: "queued"))
    }

    func deepAnalysis(articleID: Int) async throws -> DeepAnalysisResponse {
        deepAnalysisResponse
            ?? DeepAnalysisResponse(report: nil, summary: DeepAnalysisSummary(status: "queued"))
    }

    func deleteDeepAnalysis(articleID: Int) async throws -> DeepAnalysisResponse {
        DeepAnalysisResponse(report: nil, summary: DeepAnalysisSummary())
    }

    func classifyArticle(articleID: Int) async throws -> ReaderAIResult {
        ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        ReaderDeleteResult(deleted: false)
    }

    func permanentDelete(articleID: Int) async throws {}

    func renameArticle(articleID: Int, title: String) async throws {
        detail = 更新详情(title: title)
    }

    func moveArticleToCategory(articleID: Int, categoryID: Int) async throws {
        if categoryID == 4 {
            await categoryService?.禁用下次刷新分类(categoryID)
            throw AppError.categoryUnavailable(message: "分类已停用，请重新选择")
        }
        detail = 更新详情(isArchived: true, categoryID: categoryID)
    }

    private func 更新详情(
        title: String? = nil,
        isFavorited: Bool? = nil,
        isArchived: Bool? = nil,
        isPublished: Bool? = nil,
        categoryID: Int? = nil
    ) -> ArticleDetail {
        let category = categoryID.flatMap { categoryID in
            categories.first { $0.id == categoryID }
        } ?? detail.category

        return ArticleDetail(
            id: detail.id,
            title: title ?? detail.title,
            author: detail.author,
            source: detail.source,
            originalURL: detail.originalURL,
            publicID: detail.publicID,
            coverImage: detail.coverImage,
            publishTime: detail.publishTime,
            createdAt: detail.createdAt,
            aiSummary: detail.aiSummary,
            aiCategory: detail.aiCategory,
            aiTags: detail.aiTags,
            category: category,
            categoryResult: detail.categoryResult,
            isFavorited: isFavorited ?? detail.isFavorited,
            isArchived: isArchived ?? detail.isArchived,
            isPublished: isPublished ?? detail.isPublished,
            contentHTML: detail.contentHTML,
            contentMarkdown: detail.contentMarkdown,
            aiStatus: detail.aiStatus,
            aiErrorCode: detail.aiErrorCode,
            aiErrorMessage: detail.aiErrorMessage,
            aiModel: detail.aiModel,
            aiTotalTokens: detail.aiTotalTokens
        )
    }
}

extension UILabFixtures {
    static let readerClient = UILabReaderClient(
        detail: articleDetail,
        categories: readerCategories,
        categoryService: categoryService
    )

    static let readerCategoryUnavailableClient = UILabReaderClient(
        detail: readerCategoryUnavailableDetail,
        categories: readerCategories,
        categoryService: categoryService
    )

    static let readerDeepAnalysisClient = UILabReaderClient(
        detail: deepAnalysisInlineDetail,
        categories: readerCategories,
        categoryService: categoryService,
        deepAnalysisResponse: deepAnalysisResponse
    )
}

actor FixtureCategoryCatalogService: CategoryCatalogServicing {
    private var categories: [ArticleCategory]
    private var counts: [String: Int]
    private var shouldFailNextListAfterMerge = false
    private var categoryToDisableOnNextList: Int?

    init(categories: [ArticleCategory]) {
        self.categories = categories
        let fixtureCounts = [1: 3, 2: 8, 3: 6, 4: 4, 5: 2, 6: 5]
        self.counts = Dictionary(
            uniqueKeysWithValues: categories.map { category in
                (String(category.id), fixtureCounts[category.id] ?? 0)
            }
        )
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        if let categoryID = categoryToDisableOnNextList {
            categoryToDisableOnNextList = nil
            categories.removeAll { $0.id == categoryID }
            counts[String(categoryID)] = 0
        }
        if shouldFailNextListAfterMerge {
            shouldFailNextListAfterMerge = false
            throw AppError.network
        }
        return 目录响应()
    }

    func 禁用下次刷新分类(_ categoryID: Int) {
        categoryToDisableOnNextList = categoryID
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        // 为 CUA 点击创建与取消留出稳定窗口，验证提交中取消不会静默跳转。
        try await Task.sleep(for: .seconds(10))
        let nextID = (categories.map(\.id).max() ?? 0) + 1
        let category = ArticleCategory(
            id: nextID,
            name: request.name ?? "未命名分类",
            articleDescription: request.description,
            includeExamples: request.includeExamples ?? [],
            excludeExamples: request.excludeExamples ?? [],
            color: request.color,
            sortOrder: (categories.map(\.sortOrder).max() ?? 0) + 10
        )
        categories.append(category)
        counts[String(category.id)] = 0
        return CategoryResponse(category: category)
    }

    func update(
        categoryID: Int,
        request: CategoryMutationRequest
    ) async throws -> CategoryResponse {
        guard let index = categories.firstIndex(where: { $0.id == categoryID }) else {
            throw AppError.contentUnavailable
        }
        let current = categories[index]
        let category = ArticleCategory(
            id: current.id,
            name: request.name ?? current.name,
            articleDescription: request.description ?? current.articleDescription,
            includeExamples: request.includeExamples ?? current.includeExamples,
            excludeExamples: request.excludeExamples ?? current.excludeExamples,
            color: request.color ?? current.color,
            sortOrder: current.sortOrder,
            isActive: request.isActive ?? current.isActive,
            isSystem: current.isSystem
        )
        categories[index] = category
        return CategoryResponse(category: category)
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        let categoriesByID = Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
        categories = categoryIDs.enumerated().compactMap { index, categoryID in
            guard let category = categoriesByID[categoryID] else { return nil }
            return ArticleCategory(
                id: category.id,
                name: category.name,
                articleDescription: category.articleDescription,
                includeExamples: category.includeExamples,
                excludeExamples: category.excludeExamples,
                color: category.color,
                sortOrder: index * 10,
                isActive: category.isActive,
                isSystem: category.isSystem
            )
        }
        return CategoryReorderResponse(categories: categories)
    }

    func delete(
        categoryID: Int,
        targetCategoryID: Int
    ) async throws -> DeleteCategoryResponse {
        let movedArticleCount = counts[String(categoryID)] ?? 0
        categories.removeAll { $0.id == categoryID }
        counts.removeValue(forKey: String(categoryID))
        counts[String(targetCategoryID), default: 0] += movedArticleCount
        return DeleteCategoryResponse(movedArticleCount: movedArticleCount)
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        guard let sourceIndex = categories.firstIndex(where: { $0.id == sourceCategoryID }) else {
            throw AppError.contentUnavailable
        }
        let source = categories[sourceIndex]
        categories[sourceIndex] = ArticleCategory(
            id: source.id,
            name: source.name,
            articleDescription: source.articleDescription,
            includeExamples: source.includeExamples,
            excludeExamples: source.excludeExamples,
            color: source.color,
            sortOrder: source.sortOrder,
            isActive: false,
            isSystem: source.isSystem
        )
        let movedArticleCount = counts[String(sourceCategoryID)] ?? 0
        counts[String(sourceCategoryID)] = 0
        counts[String(targetCategoryID), default: 0] += movedArticleCount
        shouldFailNextListAfterMerge = source.name == "旧项目"
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        CategoryOptimizeResponse(
            draft: CategoryOptimizeDraft(
                description: request.description,
                includeExamples: request.includeExamples,
                excludeExamples: request.excludeExamples
            )
        )
    }

    private func 目录响应() -> CategoriesResponse {
        CategoriesResponse(
            categories: categories,
            counts: counts
        )
    }
}

struct UILabFixtureUpdateService: UpdateServicing {
    private let release = AppRelease(
        version: "0.2.0",
        tagName: "macos-v0.2.0",
        releaseNotes: "乾坤戒 macOS v0.2.0",
        publishedAt: nil,
        assetName: "Qiankunjie-0.2.0-arm64.dmg",
        downloadURL: URL(string: "https://example.com/Qiankunjie.dmg")!,
        checksumURL: URL(string: "https://github.com/dick86114/storing/Qiankunjie.dmg.sha256")!,
        sha256: String(repeating: "a", count: 64)
    )

    private let detailedReleaseNotes = """
        ## 新增
        - 下载确认弹窗展示新版本更新日志
        - 更新日志按版本持久化，重新打开无需再次请求

        ## 修复
        - 更新完成弹窗立即展示已缓存日志
        """

    func checkForUpdate() async throws -> AppRelease? {
        release
    }

    func fetchUpdateLog(for version: String) async throws -> String? {
        detailedReleaseNotes
    }

    func download(
        _ release: AppRelease,
        progress: @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate {
        progress(1)
        return DownloadedUpdate(
            version: release.version,
            fileURL: URL(fileURLWithPath: "/tmp/qiankunjie-ui-lab.dmg"),
            sha256: String(repeating: "a", count: 64)
        )
    }
}
#endif
