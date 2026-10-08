package com.idickies.storing.ui

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AiSettingsPresentationTest {
  private val root = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
    .first { File(it, "apps/android").exists() }!!
  private fun read(path: String) = File(root, path).readText()

  @Test
  fun `AI 设置客户端覆盖配置、发现、测试和任务`() {
    val api = read("apps/android/app/src/main/java/com/idickies/storing/network/AiApi.kt")
    listOf(
      "suspend fun settings(): UserAiSettingsResponse",
      "suspend fun save(@Body request: SaveUserAiSettingsRequest): UserAiSettingsResponse",
      "suspend fun delete(): AiSettingsDeleteResponse",
      "suspend fun discover(@Body request: DiscoverAiModelsRequest): DiscoverAiModelsResponse",
      "suspend fun test(): AiSettingsTestResponse",
      "suspend fun jobs(@Query(\"page\") page: Int, @Query(\"perPage\") perPage: Int): AiJobsResponse",
      "suspend fun retry(@Path(\"jobId\") jobId: Int): AiJobRetryResponse",
    ).forEach { assertTrue(it, api.contains(it)) }
  }

  @Test
  fun `Android 设置页提供 AI 模型入口且默认关闭`() {
    val settings = read("apps/android/app/src/main/java/com/idickies/storing/ui/SettingsScreen.kt")
    assertTrue(settings.contains("onOpenAi"))
    assertTrue(settings.contains("AI 模型"))

    val screen = read("apps/android/app/src/main/java/com/idickies/storing/ui/AiSettingsScreen.kt")
    val viewModel = read("apps/android/app/src/main/java/com/idickies/storing/ai/AiSettingsViewModel.kt")
    assertTrue(viewModel.contains("autoTriggerOnArchive: Boolean = false"))
    assertTrue(screen.contains("autoTriggerOnArchive = checked"))
    assertTrue(screen.contains("apiKeyConfigured"))
    assertTrue(screen.contains("apiKeyLast4"))
    assertTrue(screen.contains("获取模型"))
    assertTrue(screen.contains("保存配置"))
    assertTrue(screen.contains("测试生成"))
    assertTrue(screen.contains("删除配置"))
    assertTrue(screen.contains("最近任务"))
    assertTrue(screen.contains("viewModel.retry(aiJob.id)"))
  }

  @Test
  fun `Android 文章卡片和阅读页展示 AI 状态、失败原因、模型和用量`() {
    val models = read("apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt")
    listOf(
      "aiStatus",
      "aiErrorCode",
      "aiErrorMessage",
      "aiModel",
      "aiTotalTokens",
    ).forEach { assertTrue(models.contains(it)) }

    val library = read("apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt")
    assertFalse(library.contains("aiSummary: null"))
    assertFalse(library.contains("aiTags: emptyList()"))
    assertTrue(library.contains("aiStatusText(article.aiStatus)"))
    assertTrue(library.contains("ArticleProcessingAction.RegenerateAi"))
  }
}
