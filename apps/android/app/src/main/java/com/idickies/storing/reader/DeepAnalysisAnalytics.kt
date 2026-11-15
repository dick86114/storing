package com.idickies.storing.reader

import com.idickies.storing.library.DeepAnalysisReport

enum class DeepAnalysisReportSection(
  val title: String,
  val hint: String,
) {
  AiWriting("AI 写作倾向", "这篇文章更像人写还是 AI 写"),
  Arguments("核心论点", "文章最想让你相信什么"),
  Reasoning("论证链路", "作者怎样一步步推出结论"),
  Facts("关键信息与数据", "哪些信息有原文依据，哪些是 AI 推测"),
  Viewpoints("不同观点", "支持、反对和条件性看法分别是什么"),
  Risks("风险与局限", "哪些地方可能不成立"),
  Actions("行动指引", "你可以据此做什么"),
  Questions("延伸问题", "读完后还值得追问什么"),
  ReadingPath("阅读路径", "建议按什么顺序重读原文"),
}

data class DeepAnalysisEvidenceMix(
  val source: Int,
  val inference: Int,
  val total: Int,
  val sourcePercent: Int,
)

data class DeepAnalysisStanceMix(
  val support: Int,
  val conditional: Int,
  val oppose: Int,
  val total: Int,
  val supportPercent: Int,
  val conditionalPercent: Int,
  val opposePercent: Int,
)

enum class DeepAnalysisAiWritingBand(
  val label: String,
  val description: String,
) {
  Human(
    label = "更像人工写作",
    description = "语言和细节更像个人表达，但仍可能经过 AI 润色或辅助。",
  ),
  Mixed(
    label = "人机混合或特征不明显",
    description = "既有人工表达，也有模板化或 AI 辅助的迹象，单靠文本很难判断。",
  ),
  Ai(
    label = "更像 AI 写作",
    description = "存在较多模板化或均衡化特征，建议结合来源、作者信息和原文细节核实。",
  ),
}

object DeepAnalysisReportAnalytics {
  fun evidenceMix(report: DeepAnalysisReport): DeepAnalysisEvidenceMix {
    val source = report.keyFacts.count { it.basis == "source" }
    val inference = maxOf(0, report.keyFacts.size - source)
    val total = source + inference
    val sourcePercent = if (total > 0) {
      (source.toDouble() / total * 100).toInt()
    } else {
      0
    }
    return DeepAnalysisEvidenceMix(
      source = source,
      inference = inference,
      total = total,
      sourcePercent = sourcePercent,
    )
  }

  fun stanceMix(report: DeepAnalysisReport): DeepAnalysisStanceMix {
    val support = report.viewpoints.count { it.stance == "support" }
    val conditional = report.viewpoints.count { it.stance == "conditional" }
    val oppose = report.viewpoints.count { it.stance == "oppose" }
    val total = support + conditional + oppose
    val supportPercent = if (total > 0) (support.toDouble() / total * 100).toInt() else 0
    val opposePercent = if (total > 0) (oppose.toDouble() / total * 100).toInt() else 0
    return DeepAnalysisStanceMix(
      support = support,
      conditional = conditional,
      oppose = oppose,
      total = total,
      supportPercent = supportPercent,
      conditionalPercent = maxOf(0, 100 - supportPercent - opposePercent),
      opposePercent = opposePercent,
    )
  }

  fun aiWritingBand(score: Int?): DeepAnalysisAiWritingBand? {
    val normalized = score?.coerceIn(0, 100) ?: return null
    return when {
      normalized < 30 -> DeepAnalysisAiWritingBand.Human
      normalized < 60 -> DeepAnalysisAiWritingBand.Mixed
      else -> DeepAnalysisAiWritingBand.Ai
    }
  }

  fun sectionThoughts(report: DeepAnalysisReport): Map<DeepAnalysisReportSection, String> {
    val evidence = evidenceMix(report)
    val stances = stanceMix(report)
    return mapOf(
      DeepAnalysisReportSection.AiWriting to (
        report.aiWriting?.let { writing ->
          val band = aiWritingBand(writing.score)
          "${writing.score.coerceIn(0, 100)}/100，${band?.label ?: "倾向不明显"}。判断依据见下方。"
        } ?: "这份报告生成较早，暂无文章 AI 写作判断。重新生成后可查看判断依据。"
        ),
      DeepAnalysisReportSection.Arguments to (
        report.coreArguments.firstOrNull()?.let { "文章的主判断是：${compact(it.claim, 96)}" }
          ?: "报告没有提取出稳定的核心论点。"
        ),
      DeepAnalysisReportSection.Reasoning to (
        report.reasoningChain.firstOrNull()?.let {
          "作者用 ${report.reasoningChain.size} 个步骤完成论证，起点是：${compact(it, 78)}"
        } ?: "报告没有形成可追溯的论证链路。"
        ),
      DeepAnalysisReportSection.Facts to if (evidence.total > 0) {
        "共整理 ${evidence.total} 条关键信息，其中 ${evidence.source} 条能在原文找到依据，${evidence.inference} 条是 AI 补充的推测。"
      } else {
        "报告没有补充可核实的关键信息。"
      },
      DeepAnalysisReportSection.Viewpoints to if (stances.total > 0) {
        "报告补充了 ${stances.total} 个观点视角，其中支持 ${stances.support} 个、反驳 ${stances.oppose} 个、有条件判断 ${stances.conditional} 个。"
      } else {
        "报告没有提取到明显的对立观点。"
      },
      DeepAnalysisReportSection.Risks to (
        report.risks.firstOrNull()?.let { "最需要警惕的是：${compact(it, 92)}" }
          ?: "报告没有额外标注风险与局限。"
        ),
      DeepAnalysisReportSection.Actions to (
        report.actions.firstOrNull()?.let {
          "报告给出 ${report.actions.size} 条行动建议，优先关注：${compact(it.action, 82)}"
        } ?: "报告没有给出具体行动建议。"
        ),
      DeepAnalysisReportSection.Questions to (
        report.questions.firstOrNull()?.let {
          "还有 ${report.questions.size} 个问题值得继续追踪，首先是：${compact(it, 80)}"
        } ?: "报告没有留下延伸问题。"
        ),
      DeepAnalysisReportSection.ReadingPath to (
        report.readingPath.firstOrNull()?.let {
          "建议按 ${report.readingPath.size} 个节点重读原文，从“${compact(it, 56)}”开始。"
        } ?: "报告没有生成阅读路径。"
        ),
    )
  }

  private fun compact(text: String, maxLength: Int): String {
    val normalized = text.replace(Regex("\\s+"), " ").trim()
    return if (normalized.length <= maxLength) {
      normalized
    } else {
      normalized.take(maxLength).trimEnd() + "…"
    }
  }
}
