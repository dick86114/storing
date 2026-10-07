package com.idickies.storing.collect

import com.idickies.storing.database.PendingAuthActionEntity
import com.idickies.storing.database.PendingAuthActionFileEntity
import com.idickies.storing.database.PendingAuthActionWithFiles
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PendingAuthActionRestoreTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun `进程重建后恢复待登录采集链接`() {
    val saved = PendingAuthActionWithFiles(
      action = PendingAuthActionEntity(id = 1, kind = "collect_url", url = "https://example.com/a", source = "android_share"),
      files = emptyList(),
    )

    val action = saved.toPendingShareAction { null }

    assertEquals(PendingShareAction.CollectUrl("https://example.com/a", "android_share"), action)
  }

  @Test
  fun `进程重建后只恢复仍然存在的私有文件`() {
    val missing = File(temporaryFolder.root, "missing.txt")
    val existing = temporaryFolder.newFile("existing.txt")
    val saved = PendingAuthActionWithFiles(
      action = PendingAuthActionEntity(id = 2, kind = "import_files"),
      files = listOf(
        PendingAuthActionFileEntity(2, 0, "missing.txt", missing.absolutePath, 1),
        PendingAuthActionFileEntity(2, 1, "existing.txt", existing.absolutePath, 3),
      ),
    )

    val action = saved.toPendingShareAction { path -> File(path).takeIf { it.exists() } }

    assertTrue(action is PendingShareAction.ImportFiles)
    assertEquals(1, (action as PendingShareAction.ImportFiles).files.size)
    assertEquals("existing.txt", action.files.single().displayName)
  }

  @Test
  fun `全部私有文件丢失时丢弃待处理导入`() {
    val saved = PendingAuthActionWithFiles(
      action = PendingAuthActionEntity(id = 3, kind = "import_files"),
      files = listOf(PendingAuthActionFileEntity(3, 0, "missing.txt", "/missing/file.txt", 1)),
    )

    assertNull(saved.toPendingShareAction { null })
  }
}
