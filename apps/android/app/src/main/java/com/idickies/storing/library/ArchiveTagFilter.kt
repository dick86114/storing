package com.idickies.storing.library

/** 用户在归档页选择的 AI 标签辅助筛选。 */
data class ArchiveTagFilter(
  val tags: List<String>,
) {
  val isActive: Boolean get() = tags.isNotEmpty()

  val label: String get() = when (tags.size) {
    0 -> "标签"
    1 -> tags.first()
    else -> "${tags.size} 个标签"
  }

  companion object {
    val All = ArchiveTagFilter(emptyList())

    fun of(vararg values: String): ArchiveTagFilter = ArchiveTagFilter(
      values.mapNotNull { it.trim().takeIf(String::isNotEmpty) }.toCollection(linkedSetOf()).toList(),
    )
  }
}

/** 将标签选择转为重复的 Retrofit 查询参数；服务端按同时包含处理。 */
fun archiveTagQueryValues(filter: ArchiveTagFilter): List<String>? = filter.tags.takeIf { it.isNotEmpty() }

/** 搜索标签选择器中的候选项，不改变当前已选内容。 */
fun filteredArchiveTagOptions(options: List<ArticleTag>, query: String): List<ArticleTag> {
  val normalizedQuery = query.trim()
  if (normalizedQuery.isEmpty()) return options
  return options.filter { it.tag.contains(normalizedQuery, ignoreCase = true) }
}
