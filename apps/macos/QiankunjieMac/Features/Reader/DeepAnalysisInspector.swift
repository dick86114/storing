import QiankunjieCore
import SwiftUI

enum DeepAnalysisInspector {
    static let sections = [
        "一段看懂",
        "核心论点",
        "论证链路",
        "关键信息与数据",
        "不同观点",
        "风险与局限",
        "行动指引",
        "延伸问题",
        "阅读路径",
    ]

    struct Root: View {
        let report: DeepAnalysisReport?
        let status: String?
        let offline: Bool
        let onGenerate: () -> Void
        let onRetry: () -> Void
        let onShowHistory: () -> Void

        private var presentation: DeepAnalysisPresentation {
            DeepAnalysisPresentation.of(status)
        }

        private var statusText: String {
            switch presentation {
            case .idle: "未生成"
            case .running: "解析中"
            case .completed: "已有报告"
            case .failed: "解析失败"
            }
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        Image(systemName: "bubbles.and.sparkles.fill")
                            .font(.title2)
                            .foregroundStyle(.blue)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("AI 增强阅读")
                                .font(.title3.weight(.semibold))
                            Text("深度解析文章内容，提供论点、数据、不同观点和行动指引。")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 8) {
                        Text("深度报告")
                            .font(.headline)
                        Text(statusText)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                HStack {
                    Spacer()
                    if presentation == .completed {
                        Button("历史版本", action: onShowHistory)
                    }
                }
                if offline {
                    Text("当前离线，已显示缓存报告；重新生成需要网络连接。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let report {
                    section("一段看懂") { Text(report.executiveSummary) }
                    section("核心论点") {
                        ForEach(report.coreArguments, id: \.claim) { Text("\($0.claim)：\($0.evidence)") }
                    }
                    section("论证链路") { ForEach(report.reasoningChain, id: \.self, content: Text.init) }
                    section("关键信息与数据") { ForEach(report.keyFacts, id: \.fact) { Text($0.fact) } }
                    section("不同观点") {
                        ForEach(report.viewpoints, id: \.summary) { Text("\($0.summary)：\($0.reasoning)") }
                    }
                    section("风险与局限") { ForEach(report.risks, id: \.self, content: Text.init) }
                    section("行动指引") {
                        ForEach(report.actions, id: \.action) { Text("\($0.action)（\($0.condition)）") }
                    }
                    section("延伸问题") { ForEach(report.questions, id: \.self, content: Text.init) }
                    section("阅读路径") { ForEach(report.readingPath, id: \.self, content: Text.init) }
                } else {
                    Text("当前还没有成功生成的报告。").foregroundStyle(.secondary)
                }
                if presentation == .failed {
                    Button("重试", action: onRetry)
                } else {
                    Button(presentation == .completed ? "重新解析" : "深度解析", action: onGenerate)
                        .disabled(offline || presentation == .running)
                }
            }
            .padding()
        }

        @ViewBuilder
        private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.subheadline.weight(.semibold))
                content().font(.footnote).foregroundStyle(.secondary)
            }
        }
    }
}
