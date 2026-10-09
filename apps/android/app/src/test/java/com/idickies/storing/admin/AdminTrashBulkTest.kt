package com.idickies.storing.admin

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AdminTrashBulkTest {
  private fun read(path: String): String =
    File(System.getProperty("user.dir")).resolve(path).readText()

  @Test
  fun `批量清空结果保留成功数量失败数量与失败原因`() {
    val payload = """
      {
        "scope": "deleted",
        "attempted": 3,
        "succeeded": 2,
        "failed": 1,
        "deleted_metadata": 2,
        "deleted_articles": 1,
        "failures": [
          {
            "article_id": 391,
            "user_id": 12,
            "title": "微信聊天记录",
            "reason": "文章状态已变化，请刷新后重试"
          }
        ]
      }
    """.trimIndent()

    val result = Json.decodeFromString<AdminTrashBulkResult>(payload)

    assertEquals("deleted", result.scope)
    assertEquals(3, result.attempted)
    assertEquals(2, result.succeeded)
    assertEquals(1, result.failed)
    assertEquals(2, result.deletedMetadata)
    assertEquals(1, result.deletedArticles)
    assertEquals("文章状态已变化，请刷新后重试", result.failures.single().reason)
  }

  @Test
  fun `批量清空提示向管理员报告成功失败和失败明细`() {
    val failure = AdminTrashBulkFailure(
      articleId = 391,
      userId = 12,
      title = "微信聊天记录",
      reason = "文章状态已变化，请刷新后重试",
    )

    assertEquals("已删除文章清空完成：成功 2 条，失败 1 条", adminTrashBulkHeadline(scope = "deleted", succeeded = 2, failed = 1))
    assertEquals("物理删除全局文章 1 篇。", adminTrashBulkSummary(deletedArticles = 1))
    assertEquals("微信聊天记录（#391，用户 #12）：文章状态已变化，请刷新后重试", adminTrashBulkFailureText(failure))
  }

  @Test
  fun `三端契约提供独立的已删除与孤儿文章批量清空入口`() {
    val api = read("src/main/java/com/idickies/storing/admin/AdminApi.kt")
    val repository = read("src/main/java/com/idickies/storing/admin/AdminRepository.kt")
    val screen = read("src/main/java/com/idickies/storing/ui/AdminScreen.kt")

    assertTrue(api.contains("@DELETE(\"admin/trash\")"))
    assertTrue(api.contains("suspend fun clearTrash(): AdminTrashBulkResult"))
    assertTrue(api.contains("@DELETE(\"admin/trash/orphans\")"))
    assertTrue(api.contains("suspend fun clearTrashOrphans(): AdminTrashBulkResult"))
    assertTrue(repository.contains("api.clearTrash()"))
    assertTrue(repository.contains("api.clearTrashOrphans()"))
    assertTrue(screen.contains("清空已删除"))
    assertTrue(screen.contains("清空孤儿文章"))
    assertTrue(screen.contains("确认清空已删除文章"))
    assertTrue(screen.contains("确认清空孤儿文章"))
    assertTrue(screen.contains("adminTrashBulkHeadline"))
    assertTrue(screen.contains("adminTrashBulkFailureText"))
  }
}
