#if DEBUG
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI

/// UI Lab 仅服务 Debug 视觉验收；Release 构建不包含这些类型和入口。
enum UILabScenario: String, CaseIterable, Hashable, Identifiable, Sendable {
    case login
    case library
    case empty
    case loading
    case offline
    case reader
    case collect
    case tasks
    case settings
    case update

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .login: "登录"
        case .library: "三栏资料库"
        case .empty: "空态"
        case .loading: "加载"
        case .offline: "离线"
        case .reader: "阅读器"
        case .collect: "采集"
        case .tasks: "任务"
        case .settings: "设置"
        case .update: "更新"
        }
    }

    static func commandLineScenario(arguments: [String]) -> UILabScenario? {
        guard
            let index = arguments.firstIndex(of: "--ui-lab"),
            arguments.indices.contains(index + 1)
        else { return nil }

        return UILabScenario(rawValue: arguments[index + 1])
    }

    static func fromCommandLine(arguments: [String] = CommandLine.arguments) -> UILabScenario? {
        commandLineScenario(arguments: arguments)
    }
}

@MainActor
struct UILabRootView: View {
    let scenario: UILabScenario
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            switch scenario {
            case .login: login
            case .library: library
            case .empty: stateView("暂无文章", systemImage: "tray", detail: "收件箱为空时保持稳定留白。")
            case .loading: loading
            case .offline: offline
            case .reader: reader
            case .collect: collect
            case .tasks: tasks
            case .settings: settings
            case .update: update
            }
        }
        .frame(minWidth: 960, minHeight: 620)
        .background(QiankunjieColors.background(for: colorScheme))
        .foregroundStyle(QiankunjieColors.onBackground(for: colorScheme))
        .navigationTitle("UI Lab · \(scenario.displayName)")
    }

    private var login: some View {
        VStack(spacing: 18) {
            Text("登录乾坤戒")
                .font(QiankunjieTypography.headlineSmall)
            VStack(alignment: .leading, spacing: 16) {
                LabeledContent("用户名") {
                    TextField("用户名", text: .constant("uilab-user"))
                        .textFieldStyle(.roundedBorder)
                }
                LabeledContent("密码") {
                    SecureField("密码", text: .constant("uilab-only-password"))
                        .textFieldStyle(.roundedBorder)
                }
                Button("登录") {}
                    .buttonStyle(.borderedProminent)
            }
            .padding(24)
            .frame(width: 400)
            .background {
                RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                    .fill(QiankunjieColors.surface(for: colorScheme))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var library: some View {
        NavigationSplitView {
            List(selection: .constant("inbox")) {
                Label("收件箱", systemImage: "tray").tag("inbox")
                Label("收藏", systemImage: "star").tag("favorites")
                Label("归档", systemImage: "archivebox").tag("archive")
                Label("已发布", systemImage: "globe").tag("published")
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } content: {
            VStack(spacing: 0) {
                TextField("搜索文章", text: .constant("产品设计"))
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                Divider()
                List(
                    UILabFixtures.articles,
                    id: \.id,
                    selection: .constant(UILabFixtures.article.id)
                ) { article in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(article.title ?? "未命名文章")
                            .font(QiankunjieTypography.titleMedium)
                            .lineLimit(2)
                        Text(article.aiSummary ?? "暂无摘要")
                            .font(QiankunjieTypography.bodyMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .lineLimit(2)
                        Text(article.source ?? "未知来源")
                            .font(QiankunjieTypography.labelMedium)
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                    }
                    .padding(.vertical, 4)
                    .tag(article.id)
                }
            }
            .navigationSplitViewColumnWidth(min: 280, ideal: 390, max: .infinity)
        } detail: {
            readerContent
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var loading: some View {
        VStack(spacing: 14) {
            ProgressView()
            Text("正在加载资料库")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var offline: some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.slash")
                .font(.title)
            Text("网络连接失败，请稍后重试")
            Button("重试") {}
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var reader: some View {
        readerContent
    }

    private var readerContent: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(UILabFixtures.article.title ?? "")
                        .font(QiankunjieTypography.headlineSmall)
                    Text("\(UILabFixtures.article.source ?? "") · 固定阅读夹具")
                        .font(QiankunjieTypography.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                Spacer()
                Button {
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.borderless)
                .help("关闭文章")
            }
            .padding(14)
            .background(QiankunjieColors.surfaceVariant(for: colorScheme))
            Divider()

            ReaderWebView(
                html: UILabFixtures.readerHTML,
                contentToken: "uilab-reader",
                savedReadingState: nil,
                onReadingStateChange: { _, _ in }
            )
        }
    }

    private var collect: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 14) {
                Text("新建采集").font(QiankunjieTypography.headlineSmall)
                HStack {
                    TextField("粘贴公开网页链接", text: .constant("https://example.com/ui-lab"))
                        .textFieldStyle(.roundedBorder)
                    Button("采集") {}
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(18)
            Divider()

            ScrollView {
                VStack(spacing: 8) {
                    CollectJobRow(job: UILabFixtures.collectJobs[0], onOpenArticle: nil, onRetry: nil, onDelete: nil)
                }
                .padding(16)
            }
        }
    }

    private var tasks: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(UILabFixtures.collectJobs, id: \.id) { job in
                    CollectJobRow(job: job, onOpenArticle: nil, onRetry: nil, onDelete: nil)
                }
            }
            .padding(16)
        }
    }

    private var settings: some View {
        Form {
            Section("应用信息") {
                LabeledContent("版本", value: "0.1.0-ui-lab")
                LabeledContent("服务地址", value: "UILab 固定夹具")
                LabeledContent("环境", value: "Debug UI Lab")
            }
            Section("外观") {
                Picker("外观", selection: .constant("system")) {
                    Text("跟随系统").tag("system")
                    Text("浅色").tag("light")
                    Text("深色").tag("dark")
                }
                .pickerStyle(.segmented)
            }
            Section("全局采集快捷键") {
                LabeledContent("快捷键", value: "⌥⇧C")
            }
        }
        .formStyle(.grouped)
    }

    private var update: some View {
        Form {
            Section("软件更新") {
                LabeledContent("当前版本", value: "0.1.0")
                LabeledContent("更新源", value: "直连")
                LabeledContent("新版本", value: "0.2.0")
                Text("更新日志由 UI Lab 固定提供，用于检查排版。")
                    .font(QiankunjieTypography.bodyMedium)
                HStack {
                    Button("检查更新") {}
                    Button("下载更新") {}
                        .buttonStyle(.borderedProminent)
                }
                LabeledContent("校验", value: "SHA-256 校验通过")
            }
        }
        .formStyle(.grouped)
    }

    private func stateView(
        _ title: String,
        systemImage: String,
        detail: String
    ) -> some View {
        ContentUnavailableView(
            title,
            systemImage: systemImage,
            description: Text(detail)
        )
    }
}
#endif
