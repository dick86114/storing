package com.idickies.storing.offline

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import com.idickies.storing.library.ArticleDetail
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OfflineDownloadManager @Inject constructor(
  @ApplicationContext private val context: Context,
  private val dao: OfflineArticleDao,
) {
  private val client = OkHttpClient()
  private val baseDir by lazy { File(context.filesDir, "offline_articles").apply { mkdirs() } }

  /** Returns the offline article record if already downloaded. */
  suspend fun get(articleId: Int): OfflineArticle? = withContext(Dispatchers.IO) { dao.get(articleId) }

  /** Returns all downloaded offline articles. */
  suspend fun all(): List<OfflineArticle> = withContext(Dispatchers.IO) { dao.all() }

  /** Total disk usage of completed offline downloads. */
  suspend fun totalSize(): Long = withContext(Dispatchers.IO) { dao.totalSize() ?: 0L }

  /** Download article content for offline reading: HTML + cover + embedded images. */
  suspend fun download(
    article: ArticleDetail,
    html: String,
    coverUrl: String?,
  ): OfflineArticle = withContext(Dispatchers.IO) {
    val articleDir = File(baseDir, article.id.toString()).apply { mkdirs() }
    var totalSize = 0L
    var imageCount = 0

    // 1. Download cover image
    val localCoverPath = coverUrl?.let { url ->
      runCatching { downloadFile(url, File(articleDir, "cover.jpg")) }
        .onSuccess { totalSize += it.length() }
        .getOrNull()?.absolutePath
    }

    // 2. Process HTML: download embedded images and rewrite URLs
    val processedHtml = processImages(html, article.id, articleDir) { file ->
      totalSize += file.length()
      imageCount++
    }

    // 3. Save the image-rewritten HTML; the reader applies the current visual preferences at open time.
    val htmlFile = File(articleDir, "content.html")
    htmlFile.writeText(processedHtml)
    totalSize += htmlFile.length()

    val record = OfflineArticle(
      articleId = article.id,
      title = article.displayTitle,
      source = article.source,
      author = article.author,
      localHtmlPath = htmlFile.absolutePath,
      localCoverPath = localCoverPath,
      imageCount = imageCount,
      totalSizeBytes = totalSize,
      status = OfflineDownloadStatus.Completed.name,
    )
    dao.upsert(record)
    record
  }

  /**
   * Returns a completed local copy for the reader. Legacy downloads that reference
   * file:// images are normalized to the app-owned HTTPS resource origin on load.
   */
  suspend fun loadOfflineContent(articleId: Int): OfflineReaderContent? = withContext(Dispatchers.IO) {
    val record = dao.get(articleId)?.takeIf { it.status == OfflineDownloadStatus.Completed.name } ?: return@withContext null
    val htmlFile = File(record.localHtmlPath)
    if (!htmlFile.exists()) return@withContext null
    val articleDir = htmlFile.parentFile ?: return@withContext null
    OfflineReaderContent(record, normalizeOfflineAssetUrls(htmlFile.readText(), articleId, articleDir))
  }

  /** Opens a downloaded image only when it belongs to the validated article resource path. */
  fun openOfflineAsset(uri: Uri): WebResourceResponse? = runCatching {
    val request = parseOfflineAssetRequest(uri.toString()) ?: return null
    val articleDir = File(baseDir, request.articleId.toString()).canonicalFile
    val imageDir = File(articleDir, "images").canonicalFile
    val imageFile = File(imageDir, request.fileName).canonicalFile
    if (imageFile.parentFile != imageDir || !imageFile.isFile) return null
    val extension = imageFile.extension.lowercase()
    val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    WebResourceResponse(mimeType, null, imageFile.inputStream())
  }.getOrNull()

  /** Delete a single article's offline content. */
  suspend fun delete(articleId: Int) = withContext(Dispatchers.IO) {
    val record = dao.get(articleId)
    if (record != null) {
      File(record.localHtmlPath).parentFile?.deleteRecursively()
      dao.delete(articleId)
    }
  }

  /** Delete all offline content. */
  suspend fun clearAll() = withContext(Dispatchers.IO) {
    dao.clearAll()
    baseDir.deleteRecursively()
    baseDir.mkdirs()
  }

  /** Check if an article is available offline. */
  suspend fun isAvailable(articleId: Int): Boolean = withContext(Dispatchers.IO) {
    dao.get(articleId)?.status == OfflineDownloadStatus.Completed.name
  }

  private fun processImages(
    html: String,
    articleId: Int,
    articleDir: File,
    onImageDownloaded: (File) -> Unit,
  ): String {
    val imgDir = File(articleDir, "images").apply { mkdirs() }
    val imgPattern = Regex("""<img[^>]+src\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    val result = StringBuilder()
    var lastEnd = 0
    for (match in imgPattern.findAll(html)) {
      result.append(html, lastEnd, match.range.first)
      val imgUrl = match.groupValues[1]
      val localFile = runCatching {
        val extension = imgUrl.substringAfterLast(".", "jpg").take(4).lowercase()
        val fileName = "img_${UUID.randomUUID()}.$extension"
        val target = File(imgDir, fileName)
        downloadFile(imgUrl, target)
      }.getOrNull()

      if (localFile != null) {
        onImageDownloaded(localFile)
        // Serve downloaded images through a virtual HTTPS origin so WebView does not need file access.
        val replacement = match.value.replace(imgUrl, offlineAssetUrl(articleId, localFile.name))
        result.append(replacement)
      } else {
        // Keep original if download failed
        result.append(match.value)
      }
      lastEnd = match.range.last + 1
    }
    result.append(html, lastEnd, html.length)
    return result.toString()
  }

  private fun normalizeOfflineAssetUrls(html: String, articleId: Int, articleDir: File): String {
    val imageDir = File(articleDir, "images").absolutePath
    val legacyPrefix = "file://${imageDir}/"
    return html.replace(Regex("${Regex.escape(legacyPrefix)}([A-Za-z0-9._-]+)")) { match ->
      offlineAssetUrl(articleId, match.groupValues[1])
    }
  }

  private fun downloadFile(url: String, target: File): File {
    val request = Request.Builder().url(url).build()
    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) throw RuntimeException("HTTP ${response.code}")
      target.outputStream().use { output ->
        response.body?.byteStream()?.use { input ->
          input.copyTo(output)
        } ?: throw RuntimeException("Empty response body")
      }
    }
    return target
  }
}
