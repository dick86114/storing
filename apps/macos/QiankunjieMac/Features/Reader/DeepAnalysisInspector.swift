import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieReader
import SwiftUI

struct DeepAnalysisArticleContext: Equatable {
    let title: String?
    let author: String?
    let source: String?
    let publishTime: Date?
    let coverImageURL: URL?
}

enum DeepAnalysisEntryAction: Equatable {
    case viewReport
    case confirmGeneration

    static func of(
        summary: DeepAnalysisSummary?,
        hasReport: Bool = false
    ) -> DeepAnalysisEntryAction {
        hasReport || summary?.hasDeepAnalysis == true ? .viewReport : .confirmGeneration
    }
}

enum DeepAnalysisInspector {
    static let sections = DeepAnalysisSection.allCases.map(\.title)

    struct Root: View {
        let record: DeepAnalysisReportRecord?
        let summary: DeepAnalysisSummary?
        let article: DeepAnalysisArticleContext
        let offline: Bool
        let onClose: () -> Void
        let onGenerate: () -> Void
        let onRetry: () -> Void
        let onDelete: () -> Void

        @Environment(\.colorScheme) private var colorScheme
        @State private var confirmAction: DeepAnalysisConfirmAction?
        @State private var showsFailureReason = false

        private var presentation: DeepAnalysisPresentation {
            DeepAnalysisPresentation.of(summary?.status)
        }

        private var report: DeepAnalysisReport? {
            record?.reportJson
        }

        var body: some View {
            VStack(spacing: 0) {
                toolbar
                Divider()
                if let report {
                    DeepAnalysisReportView(
                        report: report,
                        record: record,
                        summary: summary,
                        article: article,
                        presentation: presentation,
                        offline: offline,
                        onGenerate: { confirmAction = .regenerate }
                    )
                } else {
                    DeepAnalysisEmptyState(
                        summary: summary,
                        offline: offline,
                        onGenerate: onGenerate,
                        onRetry: onRetry
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(QiankunjieColors.background(for: colorScheme))
            .confirmationDialog(
                confirmAction?.title ?? "",
                isPresented: Binding(
                    get: { confirmAction != nil },
                    set: { if !$0 { confirmAction = nil } }
                ),
                titleVisibility: confirmAction == nil ? .hidden : .visible
            ) {
                Button(confirmAction?.confirmTitle ?? "确认", role: confirmAction == .delete ? .destructive : nil) {
                    let action = confirmAction
                    confirmAction = nil
                    if action == .regenerate {
                        onGenerate()
                    } else if action == .delete {
                        onDelete()
                    }
                }
                Button("取消", role: .cancel) {
                    confirmAction = nil
                }
            } message: {
                Text(confirmAction?.message ?? "")
            }
            .popover(isPresented: $showsFailureReason, arrowEdge: .bottom) {
                VStack(alignment: .leading, spacing: 12) {
                    Label("失败原因", systemImage: "exclamationmark.triangle")
                        .font(.headline)
                        .foregroundStyle(errorColor)

                    Text(failureReason)
                        .font(.callout)
                        .foregroundStyle(secondary)
                        .textSelection(.enabled)

                    HStack {
                        Spacer()
                        Button("重新生成") {
                            showsFailureReason = false
                            confirmAction = .regenerate
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(18)
                .frame(width: 380, alignment: .leading)
            }
        }

        private var failureReason: String {
            let message = summary?.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines)
            return message?.isEmpty == false ? message ?? "" : "服务端未返回具体原因，可能是网络、AI 配置或任务执行异常。"
        }

        private var toolbar: some View {
            HStack(spacing: 12) {
                Button(action: onClose) {
                    Label("返回文章", systemImage: "chevron.left")
                }
                .buttonStyle(.borderless)
                .keyboardShortcut(.cancelAction)

                Divider()
                    .frame(height: 22)

                Image(systemName: "bubbles.and.sparkles.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 30, height: 30)
                    .background(
                        accent.opacity(0.12),
                        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                    )

                VStack(alignment: .leading, spacing: 1) {
                    Text("AI 增强阅读")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(secondary)
                    Text("深度报告")
                        .font(.headline)
                }

                if presentation == .running || presentation == .failed || presentation == .idle {
                    Button(action: presentation == .failed ? { showsFailureReason = true } : {}) {
                        statusChip
                    }
                    .buttonStyle(QiankunjiePlainButtonStyle())
                    .disabled(presentation != .failed)
                    .help(presentation == .failed ? "查看失败原因" : statusText)
                    .accessibilityLabel(presentation == .failed ? "查看失败原因" : statusText)
                }

                if summary?.stale == true {
                    Label("基于旧版正文", systemImage: "clock.arrow.circlepath")
                        .font(.caption)
                        .foregroundStyle(secondary)
                }

                Spacer(minLength: 8)

                if presentation == .running {
                    ProgressView()
                        .controlSize(.small)
                    Text("新一版生成中")
                        .font(.caption)
                        .foregroundStyle(secondary)
                }

                if offline {
                    Label("离线缓存", systemImage: "wifi.slash")
                        .font(.caption)
                        .foregroundStyle(secondary)
                }

                if report != nil {
                    Button {
                        confirmAction = .regenerate
                    } label: {
                        Label("重新生成", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .disabled(offline || presentation == .running)
                    .help(
                        presentation == .running
                            ? "新一版报告生成中"
                            : "重新生成一份深度报告"
                    )

                    Button {
                        confirmAction = .delete
                    } label: {
                        Label("删除报告", systemImage: "trash")
                    }
                    .buttonStyle(.bordered)
                    .tint(errorColor)
                    .help("删除这篇文章的全部深度报告版本")
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 11)
            .background(QiankunjieColors.surface(for: colorScheme))
        }

        private var statusChip: some View {
            Text(statusText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(statusColor)
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.12), in: Capsule())
        }

        private var statusText: String {
            switch presentation {
            case .idle: "未生成"
            case .running: "生成中"
            case .completed: "已生成"
            case .failed: "生成失败"
            }
        }

        private var statusColor: Color {
            switch presentation {
            case .failed: errorColor
            case .running, .completed: accent
            case .idle: secondary
            }
        }

        private var accent: Color {
            QiankunjieColors.accent(for: colorScheme)
        }

        private var secondary: Color {
            QiankunjieColors.onSurfaceVariant(for: colorScheme)
        }

        private var errorColor: Color {
            colorScheme == .dark
                ? QiankunjieColors.darkError
                : QiankunjieColors.lightError
        }
    }
}

private enum DeepAnalysisConfirmAction {
    case regenerate
    case delete

    var title: String {
        switch self {
        case .regenerate: "重新生成深度报告？"
        case .delete: "删除深度报告？"
        }
    }

    var confirmTitle: String {
        switch self {
        case .regenerate: "重新生成"
        case .delete: "删除"
        }
    }

    var message: String {
        switch self {
        case .regenerate:
            "AI 会基于当前正文创建新一版报告。生成完成前仍可阅读当前内容。"
        case .delete:
            "这篇文章的全部历史版本都会删除。删除后需要重新生成才能恢复。"
        }
    }
}

struct DeepAnalysisReportView: View {
    let report: DeepAnalysisReport
    let record: DeepAnalysisReportRecord?
    let summary: DeepAnalysisSummary?
    let article: DeepAnalysisArticleContext
    let presentation: DeepAnalysisPresentation
    let offline: Bool
    let onGenerate: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    @State private var activeSection: DeepAnalysisSection = .summary
    @State private var requestedSection: DeepAnalysisSection?

    private var thoughts: [DeepAnalysisSection: String] {
        DeepAnalysisReportAnalytics.sectionThoughts(report)
    }

    private var evidence: DeepAnalysisEvidenceMix {
        DeepAnalysisReportAnalytics.evidenceMix(report)
    }

    private var stances: DeepAnalysisStanceMix {
        DeepAnalysisReportAnalytics.stanceMix(report)
    }

    var body: some View {
        HStack(spacing: 0) {
            sidebar
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        hero
                        overview
                        aiWritingSection
                        argumentsSection
                        reasoningSection
                        factsSection
                        viewpointsSection
                        risksSection
                        actionsSection
                        questionsSection
                        readingPathSection
                        reportFooter
                    }
                    .padding(.horizontal, 34)
                    .padding(.vertical, 28)
                }
                .background(QiankunjieColors.background(for: colorScheme))
                .onChange(of: requestedSection) { _, section in
                    guard let section else { return }
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(section.id, anchor: .top)
                    }
                    requestedSection = nil
                }
            }
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 9) {
                Text(article.title ?? "深度报告")
                    .font(.headline)
                    .lineLimit(3)
                HStack(spacing: 10) {
                    Text("版本 \(record?.version ?? summary?.version ?? 1)")
                    if let generated = dateText(record?.generatedAt ?? summary?.generatedAt) {
                        Text(generated)
                    }
                }
                .font(.caption)
                .foregroundStyle(secondary)
            }
            .padding(18)

            Divider()

            Text("报告目录")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(secondary)
                .padding(.horizontal, 18)
                .padding(.top, 12)

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(DeepAnalysisSection.allCases) { section in
                        Button {
                            activeSection = section
                            requestedSection = section
                        } label: {
                            HStack(spacing: 9) {
                                Image(systemName: section.systemImage)
                                    .frame(width: 16)
                                Text(section.title)
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                            }
                            .font(.callout)
                            .foregroundStyle(
                                activeSection == section
                                    ? accent
                                    : QiankunjieColors.onSurface(for: colorScheme)
                            )
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(
                                activeSection == section
                                    ? accent.opacity(0.1)
                                    : Color.clear,
                                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                            )
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(QiankunjiePlainButtonStyle())
                    }
                }
                .padding(10)
            }

            Divider()

            VStack(alignment: .leading, spacing: 7) {
                if let model = record?.modelSnapshot, !model.isEmpty {
                    sidebarMeta("模型", model)
                }
                if let total = record?.totalTokens {
                    sidebarMeta("Token", "\(total)")
                }
                if let durationMs = record?.durationMs {
                    sidebarMeta("耗时", durationText(durationMs))
                }
                Text("关键事实请回到原文核对。")
                    .font(.caption2)
                    .foregroundStyle(secondary)
                    .padding(.top, 2)
            }
            .padding(16)
        }
        .frame(width: 224)
        .background(QiankunjieColors.surface(for: colorScheme))
    }

    private func sidebarMeta(_ label: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .foregroundStyle(secondary)
            Spacer(minLength: 4)
            Text(value)
                .lineLimit(1)
        }
        .font(.caption2)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("AI 增强阅读")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                    Text(article.title ?? "深度报告")
                        .font(.system(size: 34, weight: .semibold))
                        .lineLimit(3)
                    articleMeta
                }

                Spacer(minLength: 0)
                cover
            }

            insightCard(
                title: "一段看懂",
                text: report.executiveSummary,
                prominent: true
            )

            if summary?.stale == true {
                noticeBanner(
                    "正文已更新，当前报告基于旧版正文。",
                    systemImage: "clock.arrow.circlepath"
                )
            }

            if presentation == .running {
                noticeBanner(
                    "新一版报告正在生成，当前内容仍可阅读。",
                    systemImage: "arrow.triangle.2.circlepath"
                )
            }
        }
        .padding(.bottom, 26)
        .id(DeepAnalysisSection.summary.id)
    }

    private var articleMeta: some View {
        HStack(spacing: 14) {
            if let source = article.source, !source.isEmpty {
                Label(source, systemImage: "globe")
            }
            if let author = article.author, !author.isEmpty {
                Label(author, systemImage: "person")
            }
            if let publishTime = article.publishTime,
               let publishText = dateText(publishTime) {
                Label(publishText, systemImage: "calendar")
            }
        }
        .font(.caption)
        .foregroundStyle(secondary)
        .lineLimit(1)
    }

    private var cover: some View {
        Group {
            if let url = article.coverImageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        coverFallback
                    }
                }
            } else {
                coverFallback
            }
        }
        .frame(width: 158, height: 108)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var coverFallback: some View {
        ZStack {
            QiankunjieColors.surfaceVariant(for: colorScheme)
            Image(systemName: "doc.richtext")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(accent.opacity(0.72))
        }
    }

    private var overview: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(
                columns: Array(
                    repeating: GridItem(.flexible(minimum: 120), spacing: 10),
                    count: 4
                ),
                spacing: 10
            ) {
                metricCard(
                    value: report.coreArguments.count,
                    label: "核心论点",
                    detail: "文章的主要主张",
                    systemImage: "lightbulb"
                )
                metricCard(
                    value: report.keyFacts.count,
                    label: "关键信息",
                    detail: "\(evidence.source) 条有原文依据",
                    systemImage: "checkmark.seal"
                )
                metricCard(
                    value: report.viewpoints.count,
                    label: "不同观点",
                    detail: "\(stances.total) 个判断角度",
                    systemImage: "arrow.left.arrow.right"
                )
                metricCard(
                    value: report.actions.count,
                    label: "行动建议",
                    detail: "附适用条件",
                    systemImage: "checkmark.circle"
                )
            }

            Grid(alignment: .topLeading, horizontalSpacing: 12, verticalSpacing: 12) {
                GridRow {
                    chartCard(title: "信息依据", subtitle: "关键信息从哪里来") {
                        evidenceChart
                    }
                    chartCard(title: "观点分布", subtitle: "同一件事的不同看法") {
                        stanceChart
                    }
                }
            }
        }
    }

    private func metricCard(
        value: Int,
        label: String,
        detail: String,
        systemImage: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 28, height: 28)
                .background(
                    accent.opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
            Text("\(value)")
                .font(.system(size: 28, weight: .semibold, design: .rounded))
            Text(label)
                .font(.caption.weight(.semibold))
            Text(detail)
                .font(.caption2)
                .foregroundStyle(secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(14)
        .background(
            QiankunjieColors.surface(for: colorScheme),
            in: RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func chartCard<Content: View>(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.headline)
                Spacer(minLength: 8)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(secondary)
            }
            content()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(16)
        .background(
            QiankunjieColors.surface(for: colorScheme),
            in: RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var evidenceChart: some View {
        HStack(spacing: 18) {
            evidenceDonut
            VStack(alignment: .leading, spacing: 9) {
                legendRow(
                    color: accent,
                    label: "原文有依据",
                    count: evidence.source
                )
                legendRow(
                    color: QiankunjieColors.outline(for: colorScheme),
                    label: "AI 推测",
                    count: evidence.inference
                )
                Text("圆环只统计关键信息来源比例，不代表报告准确率。")
                    .font(.caption2)
                    .foregroundStyle(secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var evidenceDonut: some View {
        ZStack {
            Circle()
                .stroke(QiankunjieColors.outline(for: colorScheme), lineWidth: 11)
            Circle()
                .trim(from: 0, to: CGFloat(evidence.sourcePercent) / 100)
                .stroke(
                    accent,
                    style: StrokeStyle(lineWidth: 11, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(evidence.sourcePercent)%")
                    .font(.system(size: 23, weight: .semibold, design: .rounded))
                Text("来自原文")
                    .font(.caption2)
                    .foregroundStyle(secondary)
            }
        }
        .frame(width: 104, height: 104)
    }

    private func legendRow(color: Color, label: String, count: Int) -> some View {
        HStack(spacing: 7) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
            Text(label)
                .font(.caption)
                .foregroundStyle(secondary)
            Spacer(minLength: 8)
            Text("\(count)")
                .font(.caption.weight(.semibold))
        }
    }

    private var stanceChart: some View {
        VStack(alignment: .leading, spacing: 10) {
            if stances.total == 0 {
                RoundedRectangle(cornerRadius: 999)
                    .fill(QiankunjieColors.outline(for: colorScheme))
                    .frame(height: 10)
            } else {
                GeometryReader { proxy in
                    HStack(spacing: 2) {
                        if stances.support > 0 {
                            stanceSegment(
                                width: proxy.size.width * CGFloat(stances.supportPercent) / 100,
                                color: accent
                            )
                        }
                        if stances.conditional > 0 {
                            stanceSegment(
                                width: proxy.size.width * CGFloat(stances.conditionalPercent) / 100,
                                color: accent.opacity(0.45)
                            )
                        }
                        if stances.oppose > 0 {
                            stanceSegment(
                                width: proxy.size.width * CGFloat(stances.opposePercent) / 100,
                                color: QiankunjieColors.onSurface(for: colorScheme).opacity(0.52)
                            )
                        }
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 10)
            }

            VStack(spacing: 6) {
                stanceBreakdownRow(
                    "支持",
                    count: stances.support,
                    percent: stances.supportPercent,
                    color: accent
                )
                stanceBreakdownRow(
                    "有条件",
                    count: stances.conditional,
                    percent: stances.conditionalPercent,
                    color: accent.opacity(0.45)
                )
                stanceBreakdownRow(
                    "反驳",
                    count: stances.oppose,
                    percent: stances.opposePercent,
                    color: QiankunjieColors.onSurface(for: colorScheme).opacity(0.52)
                )
            }

            Text("这个条只表示报告整理出的观点数量，不代表文章作者持哪种立场。")
                .font(.caption2)
                .foregroundStyle(secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func stanceSegment(width: CGFloat, color: Color) -> some View {
        Rectangle()
            .fill(color)
            .frame(width: max(0, width))
    }

    private func stanceBreakdownRow(
        _ label: String,
        count: Int,
        percent: Int,
        color: Color
    ) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
            Text(label)
                .font(.caption)
                .foregroundStyle(secondary)
            Spacer(minLength: 8)
            Text("\(count) 个")
                .font(.caption.weight(.semibold))
            Text("\(percent)%")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(secondary)
                .frame(width: 34, alignment: .trailing)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.42),
            in: RoundedRectangle(cornerRadius: 7, style: .continuous)
        )
    }

    private var aiWritingSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.aiWriting, thought: thoughts[.aiWriting])
            if let aiWriting = report.aiWriting {
                aiWritingCard(aiWriting)
            } else {
                aiWritingFallback
            }
        }
        .id(DeepAnalysisSection.aiWriting.id)
    }

    private func aiWritingCard(_ aiWriting: DeepAnalysisReport.AIWriting) -> some View {
        let band = DeepAnalysisReportAnalytics.aiWritingBand(aiWriting.score)

        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("这篇文章像 AI 写的吗？")
                        .font(.title2.weight(.semibold))
                    Text("根据用词、结构、细节和引用方式做倾向判断，不是作者身份鉴定。")
                        .font(.callout)
                        .foregroundStyle(secondary)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text("\(max(0, min(100, aiWriting.score)))")
                            .font(.system(size: 42, weight: .semibold, design: .rounded))
                        Text("/100")
                            .font(.caption)
                            .foregroundStyle(secondary)
                    }
                    Text(band?.label ?? "倾向不明显")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    QiankunjieColors.surfaceVariant(for: colorScheme),
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )
            }

            DeepAnalysisAiWritingMeter(score: aiWriting.score)

            Text(aiWriting.summary)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
                .padding(12)
                .background(
                    accent.opacity(0.06),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("判断依据")
                        .font(.headline)
                    Spacer()
                    Text("\(aiWriting.signals.count) 条文本线索")
                        .font(.caption)
                        .foregroundStyle(secondary)
                }

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 320, maximum: 440), spacing: 10)],
                    spacing: 10
                ) {
                    ForEach(aiWriting.signals, id: \.label) { signal in
                        aiWritingSignal(signal)
                    }
                }
            }

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .foregroundStyle(secondary)
                Text("这是基于文本特征的倾向判断，不是作者身份鉴定。改写、模板化写作和人机协作都可能造成误判。")
                    .font(.caption2)
                    .foregroundStyle(secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(10)
            .background(
                QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.72),
                in: RoundedRectangle(cornerRadius: 9, style: .continuous)
            )
        }
        .padding(18)
        .background(
            QiankunjieColors.surface(for: colorScheme),
            in: RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private func aiWritingSignal(_ signal: DeepAnalysisReport.AIWritingSignal) -> some View {
        let tagColor = signal.leaning == "ai"
            ? accent
            : signal.leaning == "human"
                ? QiankunjieColors.onSurface(for: colorScheme)
                : secondary

        return VStack(alignment: .leading, spacing: 6) {
            Text(signal.leaningLabel)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tagColor)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(tagColor.opacity(0.1), in: Capsule())
            Text(signal.label)
                .font(.callout.weight(.semibold))
            Text(signal.detail)
                .font(.caption)
                .foregroundStyle(secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.46),
            in: RoundedRectangle(cornerRadius: 10, style: .continuous)
        )
    }

    private var aiWritingFallback: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bubbles.and.sparkles")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(accent)
                .frame(width: 38, height: 38)
                .background(
                    accent.opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
            VStack(alignment: .leading, spacing: 6) {
                Text("这份报告生成较早，暂无文章 AI 写作判断。")
                    .font(.callout.weight(.semibold))
                Text("重新生成后，会补充写作倾向分数、判断依据和不确定性说明。")
                    .font(.caption)
                    .foregroundStyle(secondary)
                Button("重新生成报告", action: onGenerate)
                    .buttonStyle(.bordered)
                    .disabled(offline || presentation == .running)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(
            QiankunjieColors.surface(for: colorScheme),
            in: RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
    }

    private var argumentsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.arguments, thought: thoughts[.arguments])
            VStack(spacing: 10) {
                ForEach(Array(report.coreArguments.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .top, spacing: 14) {
                        Text(String(format: "%02d", index + 1))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(accent)
                            .frame(width: 34, height: 34)
                            .background(accent.opacity(0.1), in: Circle())
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.claim)
                                .font(.headline)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(item.evidence)
                                .font(.body)
                                .foregroundStyle(secondary)
                                .fixedSize(horizontal: false, vertical: true)
                            if let anchor = item.quoteAnchor, !anchor.isEmpty {
                                Text("原文位置：\(anchor)")
                                    .font(.caption2)
                                    .foregroundStyle(secondary.opacity(0.72))
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(16)
                    .background(
                        QiankunjieColors.surface(for: colorScheme),
                        in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
                }
            }
        }
        .id(DeepAnalysisSection.arguments.id)
    }

    private var reasoningSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.reasoning, thought: thoughts[.reasoning])
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(report.reasoningChain.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .top, spacing: 14) {
                        Text("\(index + 1)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(accent)
                            .frame(width: 30, height: 30)
                            .background(accent.opacity(0.1), in: Circle())
                        Text(item)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 4)
                        Spacer(minLength: 0)
                    }
                    .padding(.bottom, index == report.reasoningChain.count - 1 ? 0 : 18)
                }
            }
        }
        .id(DeepAnalysisSection.reasoning.id)
    }

    private var factsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.facts, thought: thoughts[.facts])
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 18) {
                    evidencePane
                    factsList
                }
                VStack(alignment: .leading, spacing: 14) {
                    evidencePane
                    factsList
                }
            }
        }
        .id(DeepAnalysisSection.facts.id)
    }

    private var evidencePane: some View {
        VStack(alignment: .leading, spacing: 12) {
            evidenceDonut
            legendRow(color: accent, label: "原文有依据", count: evidence.source)
            legendRow(
                color: QiankunjieColors.outline(for: colorScheme),
                label: "AI 推测",
                count: evidence.inference
            )
            Text("优先核对有原文依据的条目。")
                .font(.caption2)
                .foregroundStyle(secondary)
        }
        .frame(width: 210, alignment: .leading)
        .padding(14)
        .background(
            QiankunjieColors.surfaceVariant(for: colorScheme).opacity(0.46),
            in: RoundedRectangle(cornerRadius: 11, style: .continuous)
        )
    }

    private var factsList: some View {
        VStack(spacing: 9) {
            ForEach(Array(report.keyFacts.enumerated()), id: \.offset) { _, item in
                let isSource = item.basis == "source"
                VStack(alignment: .leading, spacing: 6) {
                    Text(isSource ? "原文有依据" : "AI 推测")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(isSource ? accent : secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(
                            (isSource ? accent : secondary).opacity(0.1),
                            in: Capsule()
                        )
                    Text(item.fact)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                    if let anchor = item.quoteAnchor, !anchor.isEmpty {
                        Text(anchor)
                            .font(.caption2)
                            .foregroundStyle(secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(13)
                .background(
                    QiankunjieColors.surface(for: colorScheme),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var viewpointsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.viewpoints, thought: thoughts[.viewpoints])
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 340, maximum: 520), spacing: 10)],
                spacing: 10
            ) {
                ForEach(Array(report.viewpoints.enumerated()), id: \.offset) { _, item in
                    let color = stanceColor(item.stance)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(stanceLabel(item.stance))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(color)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(color.opacity(0.1), in: Capsule())
                        Text(item.summary)
                            .font(.headline)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(item.reasoning)
                            .font(.callout)
                            .foregroundStyle(secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(15)
                    .background(
                        QiankunjieColors.surface(for: colorScheme),
                        in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
                }
            }
        }
        .id(DeepAnalysisSection.viewpoints.id)
    }

    private var risksSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.risks, thought: thoughts[.risks])
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 340, maximum: 520), spacing: 10)],
                spacing: 10
            ) {
                ForEach(Array(report.risks.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 9) {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(accent)
                            .padding(.top, 2)
                        Text(item)
                            .font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(14)
                    .background(
                        QiankunjieColors.surface(for: colorScheme),
                        in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
                }
            }
        }
        .id(DeepAnalysisSection.risks.id)
    }

    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.actions, thought: thoughts[.actions])
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 340, maximum: 520), spacing: 10)],
                spacing: 10
            ) {
                ForEach(Array(report.actions.enumerated()), id: \.offset) { index, item in
                    VStack(alignment: .leading, spacing: 7) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(accent)
                        Text("建议 \(index + 1)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(secondary)
                        Text(item.action)
                            .font(.headline)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(item.condition)
                            .font(.callout)
                            .foregroundStyle(secondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 7)
                            .overlay(alignment: .top) {
                                Rectangle()
                                    .fill(QiankunjieColors.outline(for: colorScheme))
                                    .frame(height: 1)
                            }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(15)
                    .background(
                        QiankunjieColors.surface(for: colorScheme),
                        in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
                }
            }
        }
        .id(DeepAnalysisSection.actions.id)
    }

    private var questionsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.questions, thought: thoughts[.questions])
            VStack(spacing: 0) {
                ForEach(Array(report.questions.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "questionmark.circle")
                            .foregroundStyle(secondary)
                            .padding(.top, 1)
                        Text(item)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 12)
                    if index < report.questions.count - 1 {
                        Divider()
                    }
                }
            }
        }
        .id(DeepAnalysisSection.questions.id)
    }

    private var readingPathSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(.readingPath, thought: thoughts[.readingPath])
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(report.readingPath.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "link")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(accent)
                            .frame(width: 28, height: 28)
                            .background(accent.opacity(0.1), in: Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text("节点 \(index + 1)")
                                .font(.caption2)
                                .foregroundStyle(secondary)
                            Text(item)
                                .font(.body)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 10)
                    if index < report.readingPath.count - 1 {
                        Divider()
                            .padding(.leading, 40)
                    }
                }
            }
        }
        .id(DeepAnalysisSection.readingPath.id)
    }

    private func sectionHeader(
        _ section: DeepAnalysisSection,
        thought: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(section.title)
                        .font(.system(size: 26, weight: .semibold))
                    Text(section.hint)
                        .font(.callout)
                        .foregroundStyle(secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: section.systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 32, height: 32)
                    .background(
                        accent.opacity(0.1),
                        in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                    )
            }
            if let thought {
                insightCard(title: "一句话结论", text: thought)
            }
        }
        .padding(.top, 30)
        .padding(.bottom, 16)
    }

    private func insightCard(
        title: String,
        text: String,
        prominent: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(accent)
                .frame(width: 2)
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
                Text(text)
                    .font(prominent ? .body : .callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, prominent ? 15 : 11)
        .padding(.horizontal, 14)
        .background(
            accent.opacity(0.06),
            in: RoundedRectangle(cornerRadius: 10, style: .continuous)
        )
    }

    private func noticeBanner(_ text: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(accent)
            Text(text)
                .font(.caption)
                .foregroundStyle(secondary)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(
            accent.opacity(0.07),
            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
    }

    private var reportFooter: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
                .padding(.vertical, 18)
            HStack(spacing: 16) {
                if let generated = dateText(record?.generatedAt ?? summary?.generatedAt) {
                    footerMeta("生成于", generated)
                }
                if let model = record?.modelSnapshot, !model.isEmpty {
                    footerMeta("模型", model)
                }
                if let total = record?.totalTokens {
                    footerMeta("Token", "\(total)")
                }
                if let durationMs = record?.durationMs {
                    footerMeta("耗时", durationText(durationMs))
                }
            }
            Text("本报告由 AI 生成，关键事实请回到原文核对。")
                .font(.caption2)
                .foregroundStyle(secondary)
        }
        .padding(.bottom, 12)
    }

    private func footerMeta(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(secondary)
            Text(value)
                .font(.caption)
                .lineLimit(1)
        }
    }

    private func stanceLabel(_ stance: String) -> String {
        switch stance {
        case "support": "支持"
        case "oppose": "反驳"
        case "conditional": "有条件"
        default: "观点"
        }
    }

    private func stanceColor(_ stance: String) -> Color {
        switch stance {
        case "support": accent
        case "oppose": QiankunjieColors.onSurface(for: colorScheme).opacity(0.66)
        default: accent.opacity(0.66)
        }
    }

    private func dateText(_ date: Date?) -> String? {
        guard let date else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func durationText(_ durationMs: Int) -> String {
        let seconds = max(0, Int((Double(durationMs) / 1000).rounded()))
        if seconds < 60 { return "\(seconds) 秒" }
        return "\(seconds / 60) 分 \(seconds % 60) 秒"
    }

    private var accent: Color {
        QiankunjieColors.accent(for: colorScheme)
    }

    private var secondary: Color {
        QiankunjieColors.onSurfaceVariant(for: colorScheme)
    }
}

struct DeepAnalysisEmptyState: View {
    let summary: DeepAnalysisSummary?
    let offline: Bool
    let onGenerate: () -> Void
    let onRetry: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var presentation: DeepAnalysisPresentation {
        DeepAnalysisPresentation.of(summary?.status)
    }

    var body: some View {
        VStack(spacing: 16) {
            Spacer(minLength: 0)

            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 74, height: 74)
                .background(
                    accent.opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                )

            Text(title)
                .font(.title2.weight(.semibold))

            Text(message)
                .font(.body)
                .foregroundStyle(secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)

            if let failureMessage = summary?.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
               !failureMessage.isEmpty,
               presentation == .failed {
                Text(failureMessage)
                    .font(.callout.monospaced())
                    .foregroundStyle(secondary.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 520)
                    .padding(12)
                    .background(QiankunjieColors.surface(for: colorScheme))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if presentation == .running {
                ProgressView()
                    .controlSize(.regular)
                    .padding(.top, 4)
            }

            if offline {
                Label("当前离线，重新生成需要网络连接。", systemImage: "wifi.slash")
                    .font(.caption)
                    .foregroundStyle(secondary)
            }

            if presentation == .failed || presentation == .completed {
                Button("重新生成", action: onRetry)
                    .buttonStyle(.borderedProminent)
                    .disabled(offline || presentation == .running)
            } else if presentation == .idle {
                Button("生成深度报告", action: onGenerate)
                    .buttonStyle(.borderedProminent)
                    .disabled(offline)
            }

            Spacer(minLength: 0)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var systemImage: String {
        switch presentation {
        case .running: "bubbles.and.sparkles"
        case .failed: "exclamationmark.triangle"
        case .completed: "doc.text.magnifyingglass"
        default: "bubbles.and.sparkles.fill"
        }
    }

    private var title: String {
        switch presentation {
        case .running: "深度报告正在生成"
        case .failed: "深度报告生成失败"
        case .completed: "报告内容暂时不可用"
        default: "还没有深度报告"
        }
    }

    private var message: String {
        switch presentation {
        case .running:
            "AI 正在解析全文。完成后页面会自动刷新，你也可以先返回文章继续阅读。"
        case .failed:
            "可以重新生成一份报告，旧内容不会受影响。"
        case .completed:
            "服务端标记为已生成，但正文没有加载成功。可以重新生成一份报告。"
        default:
            "生成后会在这里呈现核心论点、信息依据、不同观点和行动建议。"
        }
    }

    private var accent: Color {
        QiankunjieColors.accent(for: colorScheme)
    }

    private var secondary: Color {
        QiankunjieColors.onSurfaceVariant(for: colorScheme)
    }
}

struct DeepAnalysisStatusMark: View {
    let summary: DeepAnalysisSummary?

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let marker = DeepAnalysisListMarker.of(summary)

        Group {
            switch marker.kind {
            case .hidden:
                EmptyView()
            case .running:
                ZStack {
                    Circle()
                        .fill(accent.opacity(0.1))
                    ProgressView()
                        .controlSize(.mini)
                        .tint(accent)
                }
                .frame(width: 20, height: 20)
            case .ready:
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bubbles.and.sparkles.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(accent)
                        .frame(width: 20, height: 20)
                        .background(accent.opacity(0.1), in: Circle())
                    if marker.isStale {
                        Circle()
                            .fill(accent)
                            .frame(width: 5, height: 5)
                            .overlay {
                                Circle()
                                    .strokeBorder(
                                        QiankunjieColors.surface(for: colorScheme),
                                        lineWidth: 1
                                    )
                            }
                    }
                }
            case .failed:
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(errorColor)
                    .frame(width: 20, height: 20)
                    .background(errorColor.opacity(0.1), in: Circle())
            }
        }
        .help(marker.helpText)
        .accessibilityLabel(marker.helpText)
    }

    private var accent: Color {
        QiankunjieColors.accent(for: colorScheme)
    }

    private var errorColor: Color {
        colorScheme == .dark
            ? QiankunjieColors.darkError
            : QiankunjieColors.lightError
    }
}

struct DeepAnalysisAiWritingMeter: View {
    let score: Int

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 7) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(QiankunjieColors.onSurface(for: colorScheme).opacity(0.32))
                            .frame(width: proxy.size.width * 0.3)
                        Rectangle()
                            .fill(accent.opacity(0.4))
                            .frame(width: proxy.size.width * 0.3)
                        Rectangle()
                            .fill(accent)
                            .frame(width: proxy.size.width * 0.4)
                    }
                    .clipShape(Capsule())

                    Circle()
                        .fill(QiankunjieColors.onSurface(for: colorScheme))
                        .frame(width: 15, height: 15)
                        .overlay {
                            Circle()
                                .strokeBorder(
                                    QiankunjieColors.surface(for: colorScheme),
                                    lineWidth: 2
                                )
                        }
                        .offset(
                            x: max(
                                0,
                                min(
                                    proxy.size.width - 15,
                                    proxy.size.width * CGFloat(max(0, min(100, score))) / 100 - 7.5
                                )
                            )
                        )
                }
            }
            .frame(height: 15)

            HStack {
                Text("更像人工")
                Spacer()
                Text("混合 / 不明显")
                Spacer()
                Text("更像 AI")
            }
            .font(.caption2)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        }
    }

    private var accent: Color {
        QiankunjieColors.accent(for: colorScheme)
    }
}

private extension DeepAnalysisReport.AIWritingSignal {
    var leaningLabel: String {
        switch leaning {
        case "ai": "支持 AI"
        case "human": "支持人工"
        default: "中性线索"
        }
    }
}
