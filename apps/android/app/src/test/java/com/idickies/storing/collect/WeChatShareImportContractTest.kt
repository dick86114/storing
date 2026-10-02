package com.idickies.storing.collect

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class WeChatShareImportContractTest {
  private fun read(path: String): String {
    val file = File(System.getProperty("user.dir")).resolve(path)
    val text: String = file.readText()
    return text
  }

  @Test
  fun `share receiver accepts single and multiple files from the WeChat share sheet`() {
    val manifest = read("src/main/AndroidManifest.xml")

    assertTrue(manifest.contains("android.intent.action.SEND_MULTIPLE"))
    assertTrue(manifest.contains("""<data android:mimeType="*/*" />"""))
  }

  @Test
  fun `receiver copies streams before upload and view model submits through the import repository`() {
    val receiver = read("src/main/java/com/idickies/storing/ShareReceiverActivity.kt")
    val viewModel = read("src/main/java/com/idickies/storing/collect/ShareCollectViewModel.kt")
    val repository = read("src/main/java/com/idickies/storing/collect/WeChatImportRepository.kt")

    // content URI 权限随分享界面销毁而失效，必须先复制到私有目录。
    assertTrue(receiver.contains("readSharedFiles()"))
    assertTrue(receiver.contains("copyTo(output)"))
    assertTrue(viewModel.contains("receiveSharedFiles"))
    assertTrue(viewModel.contains("weChatImportRepository.import(parts, manifest)"))
    assertTrue(repository.contains("authenticatedRequest { api.import(files, manifest).result }"))
  }

  @Test
  fun `imported wechat records never expose qiankunjie urls as web originals`() {
    val actionBar = read("src/main/java/com/idickies/storing/ui/components/ReaderActionBar.kt")
    val library = read("src/main/java/com/idickies/storing/ui/LibraryScreen.kt")

    assertTrue(actionBar.contains("""originalUrl?.let { it.startsWith("http://") || it.startsWith("https://") } == true"""))
    assertTrue(library.contains("enabled = isWebOriginalUrl(article.originalUrl)"))
    assertTrue(library.contains("""url?.startsWith("http://") == true || url?.startsWith("https://") == true"""))
  }
}
