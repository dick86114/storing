import Foundation
import QiankunjieCore

enum DeepAnalysisSection: String, CaseIterable, Identifiable {
    case summary
    case aiWriting
    case arguments
    case reasoning
    case facts
    case viewpoints
    case risks
    case actions
    case questions
    case readingPath

    var id: String { rawValue }

    var title: String {
        switch self {
        case .summary: "一段看懂"
        case .aiWriting: "AI 写作倾向"
        case .arguments: "核心论点"
        case .reasoning: "论证链路"
        case .facts: "关键信息与数据"
        case .viewpoints: "不同观点"
        case .risks: "风险与局限"
        case .actions: "行动指引"
        case .questions: "延伸问题"
        case .readingPath: "阅读路径"
        }
    }

    var hint: String {
        switch self {
        case .summary: "先用一分钟抓住全文判断"
        case .aiWriting: "这篇文章更像人写还是 AI 写"
        case .arguments: "文章最想让你相信什么"
        case .reasoning: "作者怎样一步步推出结论"
        case .facts: "哪些信息有原文依据，哪些是 AI 推测"
        case .viewpoints: "支持、反对和条件性看法分别是什么"
        case .risks: "哪些地方可能不成立"
        case .actions: "你可以据此做什么"
        case .questions: "读完后还值得追问什么"
        case .readingPath: "建议按什么顺序重读原文"
        }
    }

    var systemImage: String {
        switch self {
        case .summary: "text.quote"
        case .aiWriting: "bubbles.and.sparkles"
        case .arguments: "lightbulb"
        case .reasoning: "list.number"
        case .facts: "checkmark.seal"
        case .viewpoints: "arrow.left.arrow.right"
        case .risks: "exclamationmark.triangle"
        case .actions: "checkmark.circle"
        case .questions: "questionmark.circle"
        case .readingPath: "map"
        }
    }
}

struct DeepAnalysisEvidenceMix: Equatable {
    let source: Int
    let inference: Int
    let total: Int
    let sourcePercent: Int
    let inferencePercent: Int
}

struct DeepAnalysisStanceMix: Equatable {
    let support: Int
    let conditional: Int
    let oppose: Int
    let total: Int
    let supportPercent: Int
    let conditionalPercent: Int
    let opposePercent: Int
}

enum DeepAnalysisAiWritingBand: String, Equatable {
    case human
    case mixed
    case ai

    var label: String {
        switch self {
        case .human: "更像人工写作"
        case .mixed: "人机混合或特征不明显"
        case .ai: "更像 AI 写作"
        }
    }

    var description: String {
        switch self {
        case .human: "语言和细节更像个人表达，但仍可能经过 AI 润色或辅助。"
        case .mixed: "既有人工表达，也有模板化或 AI 辅助的迹象，单靠文本很难判断。"
        case .ai: "存在较多模板化或均衡化特征，建议结合来源、作者信息和原文细节核实。"
        }
    }
}

struct DeepAnalysisListMarker: Equatable {
    enum Kind: Equatable {
        case hidden
        case running
        case ready
        case failed
    }

    let kind: Kind
    let isStale: Bool

    var helpText: String {
        switch kind {
        case .hidden: ""
        case .running: "深度报告生成中"
        case .ready:
            isStale ? "深度报告已生成，当前基于旧版正文" : "深度报告已生成"
        case .failed: "深度报告生成失败，打开文章可重试"
        }
    }

    static func of(_ summary: DeepAnalysisSummary?) -> DeepAnalysisListMarker {
        guard let summary else {
            return DeepAnalysisListMarker(kind: .hidden, isStale: false)
        }
        switch summary.status {
        case "queued", "running":
            return DeepAnalysisListMarker(kind: .running, isStale: summary.stale)
        case "succeeded":
            return DeepAnalysisListMarker(kind: .ready, isStale: summary.stale)
        case "failed":
            return DeepAnalysisListMarker(kind: .failed, isStale: summary.stale)
        default:
            return DeepAnalysisListMarker(kind: .hidden, isStale: false)
        }
    }
}

enum DeepAnalysisReportAnalytics {
    static func evidenceMix(_ report: DeepAnalysisReport) -> DeepAnalysisEvidenceMix {
        let source = report.keyFacts.filter { $0.basis == "source" }.count
        let inference = max(0, report.keyFacts.count - source)
        let total = source + inference
        let sourcePercent = total > 0 ? Int((Double(source) / Double(total) * 100).rounded()) : 0
        return DeepAnalysisEvidenceMix(
            source: source,
            inference: inference,
            total: total,
            sourcePercent: sourcePercent,
            inferencePercent: max(0, 100 - sourcePercent)
        )
    }

    static func stanceMix(_ report: DeepAnalysisReport) -> DeepAnalysisStanceMix {
        let support = report.viewpoints.filter { $0.stance == "support" }.count
        let conditional = report.viewpoints.filter { $0.stance == "conditional" }.count
        let oppose = report.viewpoints.filter { $0.stance == "oppose" }.count
        let total = support + conditional + oppose
        let supportPercent = total > 0 ? Int((Double(support) / Double(total) * 100).rounded()) : 0
        let opposePercent = total > 0 ? Int((Double(oppose) / Double(total) * 100).rounded()) : 0
        return DeepAnalysisStanceMix(
            support: support,
            conditional: conditional,
            oppose: oppose,
            total: total,
            supportPercent: supportPercent,
            conditionalPercent: max(0, 100 - supportPercent - opposePercent),
            opposePercent: opposePercent
        )
    }

    static func aiWritingBand(_ score: Int?) -> DeepAnalysisAiWritingBand? {
        guard let score else { return nil }
        let normalized = max(0, min(100, score))
        if normalized < 30 { return .human }
        if normalized < 60 { return .mixed }
        return .ai
    }

    static func sectionThoughts(_ report: DeepAnalysisReport) -> [DeepAnalysisSection: String] {
        let evidence = evidenceMix(report)
        let stances = stanceMix(report)
        var thoughts: [DeepAnalysisSection: String] = [:]

        if let aiWriting = report.aiWriting {
            let band = aiWritingBand(aiWriting.score)
            thoughts[.aiWriting] = "\(aiWriting.score)/100，\(band?.label ?? "倾向不明显")。判断依据见下方。"
        } else {
            thoughts[.aiWriting] = "这份报告生成较早，暂无文章 AI 写作判断。重新生成后可查看判断依据。"
        }

        if let firstArgument = report.coreArguments.first {
            thoughts[.arguments] = "文章的主判断是：\(compact(firstArgument.claim, 96))"
        } else {
            thoughts[.arguments] = "报告没有提取出稳定的核心论点。"
        }

        if let firstReasoning = report.reasoningChain.first {
            thoughts[.reasoning] = "作者用 \(report.reasoningChain.count) 个步骤完成论证，起点是：\(compact(firstReasoning, 78))"
        } else {
            thoughts[.reasoning] = "报告没有形成可追溯的论证链路。"
        }

        thoughts[.facts] = evidence.total > 0
            ? "共整理 \(evidence.total) 条关键信息，其中 \(evidence.source) 条能在原文找到依据，\(evidence.inference) 条是 AI 补充的推测。"
            : "报告没有补充可核实的关键信息。"

        thoughts[.viewpoints] = stances.total > 0
            ? "报告补充了 \(stances.total) 个观点视角，其中支持 \(stances.support) 个、反驳 \(stances.oppose) 个、有条件判断 \(stances.conditional) 个。"
            : "报告没有提取到明显的对立观点。"

        if let firstRisk = report.risks.first {
            thoughts[.risks] = "最需要警惕的是：\(compact(firstRisk, 92))"
        } else {
            thoughts[.risks] = "报告没有额外标注风险与局限。"
        }

        if let firstAction = report.actions.first {
            thoughts[.actions] = "报告给出 \(report.actions.count) 条行动建议，优先关注：\(compact(firstAction.action, 82))"
        } else {
            thoughts[.actions] = "报告没有给出具体行动建议。"
        }

        if let firstQuestion = report.questions.first {
            thoughts[.questions] = "还有 \(report.questions.count) 个问题值得继续追踪，首先是：\(compact(firstQuestion, 80))"
        } else {
            thoughts[.questions] = "报告没有留下延伸问题。"
        }

        if let firstStep = report.readingPath.first {
            thoughts[.readingPath] = "建议按 \(report.readingPath.count) 个节点重读原文，从“\(compact(firstStep, 56))”开始。"
        } else {
            thoughts[.readingPath] = "报告没有生成阅读路径。"
        }

        return thoughts
    }

    static func compact(_ text: String, _ maxLength: Int) -> String {
        let normalized = text
            .replacingOccurrences(of: "\n", with: " ")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
        guard normalized.count > maxLength else { return normalized }
        return String(normalized.prefix(maxLength)).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }
}
