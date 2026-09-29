#if DEBUG
import Foundation
import QiankunjieAuth
import QiankunjieCore

/// UI Lab 的所有内容都在进程内固定；不会写入用户数据或请求生产服务。
enum UILabFixtures {
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
        isFavorited: true
    )

    static let articles = [
        article,
        ArticleCard(
            id: 1002,
            title: "三栏资料库紧凑列表压力样例",
            source: "固定样例",
            aiSummary: "验证较长标题和多行摘要不会被裁切到不可读。",
            aiTags: ["资料库"]
        ),
    ]

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
          {"id":7001,"url":"https://example.com/collect-running","normalized_url":"https://example.com/collect-running","status":"running","stage":"正在提取正文","article_id":null,"title":"运行中的固定采集任务"},
          {"id":7002,"url":"https://example.com/collect-complete","normalized_url":"https://example.com/collect-complete","status":"completed","stage":"finished","article_id":1001,"title":"已完成的固定采集任务"},
          {"id":7003,"url":"https://example.com/collect-failed","normalized_url":"https://example.com/collect-failed","status":"failed","stage":"failed","article_id":null,"title":"失败的固定采集任务","error":"fixture timeout","error_summary":"内容提取超时","error_hint":"重试时使用同一个固定夹具"}
        ]
        """
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return (try? decoder.decode([CollectJob].self, from: Data(payload.utf8))) ?? []
    }()
}
#endif
