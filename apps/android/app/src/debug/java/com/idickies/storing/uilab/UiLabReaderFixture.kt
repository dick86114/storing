package com.idickies.storing.uilab

/** Deterministic server-sanitized-like HTML used only by the Debug UI Lab WebView scenario. */
internal object UiLabReaderFixture {
  val capturedHtml = """
<!doctype html>
<html lang="zh-CN" data-ui-lab-reader="true">
<head>
  <meta charset="utf-8">
  <style>
    :root { color-scheme: light; }
    body { margin:0; background:#ffffff; color:#202124; font-family:-apple-system,BlinkMacSystemFont,"Noto Sans SC",sans-serif; }
    article { max-width:760px; margin:0 auto; padding:24px 20px 48px; }
    .source { color:#AA3E35; font-size:14px; font-weight:700; letter-spacing:.02em; }
    h1 { margin:10px 0 20px; font-size:31px; line-height:1.28; letter-spacing:-.025em; }
    .meta { color:#6c635f; font-size:14px; margin-bottom:22px; }
    .lead { color:#514944; font-size:19px; line-height:1.8; }
    h2 { margin:34px 0 12px; font-size:23px; line-height:1.45; }
    p, li { font-size:17px; line-height:1.9; }
    blockquote { margin:24px 0; padding:2px 18px; border-left:4px solid #AA3E35; color:#5b514d; background:#fff7f5; }
    .hero { width:100%; border-radius:18px; margin:22px 0 4px; }
    figure { margin:20px 0; }
    figcaption { margin-top:8px; color:#756b66; font-size:13px; text-align:center; }
    .table-wrap { overflow-x:auto; margin:22px 0; border:1px solid #eadfd8; border-radius:14px; }
    table { min-width:680px; border-collapse:collapse; background:#fff; }
    th, td { padding:12px 14px; text-align:left; border-bottom:1px solid #eee5df; }
    th { color:#7d3029; background:#fff7f5; }
    code { padding:2px 5px; border-radius:5px; background:#f4efea; font-size:.92em; }
    a { color:#8e352d; font-weight:650; }
  </style>
</head>
<body>
  <article>
    <div class="source">少数派 · WebView 长文夹具</div>
    <h1>把真正重要的内容留下来：从稍后读到个人知识空间</h1>
    <div class="meta">12 分钟阅读 · 固定本地内容 · 不访问网络</div>
    <figure>
      <img class="hero" alt="知识空间示意图" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 560'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%234c7782'/%3E%3Cstop offset='1' stop-color='%2394c7bd'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='560' rx='42' fill='url(%23g)'/%3E%3Cpath d='M420 340V190c74-28 144-14 180 26v154c-36-40-106-54-180-26Zm360 0V190c-74-28-144-14-180 26v154c36-40 106-54 180-26Z' fill='none' stroke='white' stroke-width='22' stroke-linejoin='round'/%3E%3C/svg%3E">
      <figcaption>内联 SVG 图片：验证宽图在小屏阅读器中的自适应缩放。</figcaption>
    </figure>
    <p class="lead">阅读器的价值不是把网页缩小，而是让原有文章结构、图片和排版在手机上仍然稳定、可读，并让操作层不打断注意力。</p>
    <h2>一、长链接与引用不应撑破版面</h2>
    <p>这段文字包含一个用于换行校验的长链接：<a href="https://example.com/a-very-long-path-for-testing-reader-overflow-and-external-navigation?with=query&and=multiple-values">https://example.com/a-very-long-path-for-testing-reader-overflow-and-external-navigation?with=query&amp;and=multiple-values</a>。</p>
    <blockquote>保存原网页的结构，不等于保留桌面端的横向溢出。移动端的约束应该只解决阅读问题，不改写作者表达。</blockquote>
    <h2>二、超宽表格保留横向阅读能力</h2>
    <div class="table-wrap"><table><thead><tr><th>阶段</th><th>目标</th><th>验证项</th><th>状态</th><th>备注</th></tr></thead><tbody><tr><td>采集</td><td>保存网页</td><td>任务恢复</td><td>完成</td><td>入收件箱</td></tr><tr><td>阅读</td><td>呈现正文</td><td>图片、链接、表格</td><td>联调中</td><td>固定夹具</td></tr><tr><td>发布</td><td>形成版本</td><td>APK 签名</td><td>后续</td><td>自托管</td></tr></tbody></table></div>
    <h2>三、正文仍然由原网页决定</h2>
    <p>此夹具模拟一篇采集后的文章，包含图片、引用、表格、<code>inline code</code> 与外部链接。UI Lab 只验证移动约束和原生壳层，绝不读取真实账号、Token 或线上正文。</p>
  </article>
</body>
</html>
  """.trimIndent()
}
