package com.idickies.storing.offline

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.library.ArticleDetail
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
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
  private val sessionStore: SessionStore,
  private val json: Json,
) {
  private val client = OkHttpClient()
  private val baseDir by lazy { File(context.filesDir, "offline_articles").apply { mkdirs() } }

  /** 固定离线保存的文章，包含完整图片资源。 */
  suspend fun pinnedArticles(): List<OfflineArticle> = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    dao.pinned(userId)
  }

  /** 所有未固定自动缓存的占用。 */
  suspend fun automaticCacheSize(): Long = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    trimAutomaticCache(userId)
    dao.automaticSize(userId) ?: 0L
  }

  /** 所有未固定自动缓存的文章数量。 */
  suspend fun automaticCacheCount(): Int = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    trimAutomaticCache(userId)
    dao.automaticCount(userId)
  }

  /** 固定离线保存内容的总占用。 */
  suspend fun pinnedTotalSize(): Long = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    dao.pinnedSize(userId) ?: 0L
  }

  suspend fun isPinned(articleId: Int): Boolean = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    dao.get(userId, articleId)?.isPinned == true
  }

  /**
   * 阅读时优先使用本地正文。固定离线条目会加载本地图片；
   * 自动缓存条目仍使用原始图片地址，图片是否命中由网络与图片缓存决定。
   */
  suspend fun loadForReading(articleId: Int): OfflineReaderContent? = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val record = dao.get(userId, articleId)
      ?.takeIf { it.status == OfflineDownloadStatus.Completed.name }
      ?: return@withContext null
    loadRecord(record)
  }

  suspend fun loadPinnedForReading(articleId: Int): OfflineReaderContent? = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val record = dao.get(userId, articleId)
      ?.takeIf { it.isPinned && it.hasCompleteAssets && it.status == OfflineDownloadStatus.Completed.name }
      ?: return@withContext null
    loadRecord(record)
  }

  /**
   * 保存自动正文缓存。已是固定离线保存的文章不会被降级覆盖。
   * 自动缓存只保存正文 HTML 和详情元数据，不主动下载图片。
   */
  suspend fun saveAutomatic(article: ArticleDetail): OfflineArticle? = withContext(Dispatchers.IO) {
    val html = article.contentHtml?.takeIf { it.isNotBlank() } ?: return@withContext null
    val userId = prepareUser()
    val now = System.currentTimeMillis()
    val existing = dao.get(userId, article.id)
    if (existing?.isPinned == true) {
      dao.touch(userId, article.id, now)
      return@withContext existing
    }

    val articleDir = articleDirectory(userId, article.id).apply { mkdirs() }
    val htmlFile = File(articleDir, "content.html")
    htmlFile.writeText(html)
    val detailJson = json.encodeToString(
      ArticleDetail.serializer(),
      article.copy(contentHtml = null, contentMd = null),
    )
    val record = OfflineArticle(
      articleId = article.id,
      userId = userId,
      title = article.displayTitle,
      source = article.source,
      author = article.author,
      localHtmlPath = htmlFile.absolutePath,
      localCoverPath = null,
      imageCount = 0,
      totalSizeBytes = htmlFile.length(),
      status = OfflineDownloadStatus.Completed.name,
      downloadedAtEpochMs = now,
      isPinned = false,
      hasCompleteAssets = false,
      detailJson = detailJson,
      cachedAtEpochMs = now,
      lastAccessedAtEpochMs = now,
    )
    dao.upsert(record)
    trimAutomaticCache(userId)
    record
  }

  /** 下载文章内容为固定离线保存：HTML + 封面 + 内嵌图片。 */
  suspend fun download(
    article: ArticleDetail,
    html: String,
    coverUrl: String?,
  ): OfflineArticle = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val articleDir = articleDirectory(userId, article.id).apply { mkdirs() }
    var totalSize = 0L
    var imageCount = 0

    val localCoverPath = coverUrl?.let { url ->
      runCatching { downloadFile(url, File(articleDir, "cover.jpg")) }
        .onSuccess { totalSize += it.length() }
        .getOrNull()?.absolutePath
    }

    val processedHtml = processImages(html, article.id, articleDir) { file ->
      totalSize += file.length()
      imageCount++
    }

    val htmlFile = File(articleDir, "content.html")
    htmlFile.writeText(processedHtml)
    totalSize += htmlFile.length()
    val now = System.currentTimeMillis()
    val record = OfflineArticle(
      articleId = article.id,
      userId = userId,
      title = article.displayTitle,
      source = article.source,
      author = article.author,
      localHtmlPath = htmlFile.absolutePath,
      localCoverPath = localCoverPath,
      imageCount = imageCount,
      totalSizeBytes = totalSize,
      status = OfflineDownloadStatus.Completed.name,
      downloadedAtEpochMs = now,
      isPinned = true,
      hasCompleteAssets = true,
      detailJson = json.encodeToString(
        ArticleDetail.serializer(),
        article.copy(contentHtml = null, contentMd = null),
      ),
      cachedAtEpochMs = now,
      lastAccessedAtEpochMs = now,
    )
    dao.upsert(record)
    record
  }

  /** 删除指定文章的本地记录，包括固定离线保存与自动缓存。 */
  suspend fun delete(articleId: Int) = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val record = dao.get(userId, articleId)
    dao.delete(userId, articleId)
    record?.let(::deleteRecordFiles)
  }

  /** 清理全部固定离线保存，不影响自动正文缓存。 */
  suspend fun clearPinned() = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val records = dao.pinned(userId)
    dao.clearPinned(userId)
    records.forEach(::deleteRecordFiles)
  }

  /** 清理全部自动正文缓存，保留固定离线保存。 */
  suspend fun clearAutomaticCache() = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val records = dao.automatic(userId)
    dao.clearAutomatic(userId)
    records.forEach(::deleteRecordFiles)
  }

  /** 立即执行一次自动缓存淘汰，应用启动和查看缓存占用时调用。 */
  suspend fun trimAutomaticCache() = withContext(Dispatchers.IO) {
    trimAutomaticCache(prepareUser())
  }

  /** 打开已固定文章的内嵌图片，只允许 app 自己的离线资源路径。 */
  fun openOfflineAsset(uri: Uri): WebResourceResponse? = runCatching {
    val request = parseOfflineAssetRequest(uri.toString()) ?: return null
    val userId = sessionStore.read()?.userId ?: 0
    val imageDirs = listOf(
      File(articleDirectory(userId, request.articleId), "images"),
      File(File(baseDir, request.articleId.toString()), "images"),
    )
    for (imageDir in imageDirs) {
      val canonicalDir = imageDir.canonicalFile
      val imageFile = File(canonicalDir, request.fileName).canonicalFile
      if (imageFile.parentFile != canonicalDir || !imageFile.isFile) continue
      val extension = imageFile.extension.lowercase()
      val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
      return WebResourceResponse(mimeType, null, imageFile.inputStream())
    }
    null
  }.getOrNull()

  private suspend fun prepareUser(): Int {
    val userId = sessionStore.read()?.userId ?: 0
    if (userId > 0) dao.claimLegacy(userId)
    return userId
  }

  private fun articleDirectory(userId: Int, articleId: Int): File =
    File(File(baseDir, "user-$userId"), "article-$articleId")

  private suspend fun loadRecord(record: OfflineArticle): OfflineReaderContent? {
    val htmlFile = File(record.localHtmlPath)
    if (!htmlFile.isFile) return null
    val articleDir = htmlFile.parentFile ?: return null
    val html = htmlFile.readText()
    val normalizedHtml = if (record.isPinned) {
      normalizeOfflineAssetUrls(html, record.articleId, articleDir)
    } else {
      html
    }
    val detail = record.detailJson?.let { payload ->
      runCatching { json.decodeFromString(ArticleDetail.serializer(), payload) }.getOrNull()
    }
    dao.touch(record.userId, record.articleId, System.currentTimeMillis())
    return OfflineReaderContent(record, normalizedHtml, detail)
  }

  private suspend fun trimAutomaticCache(userId: Int) {
    val entries = dao.automatic(userId)
    val evictions = automaticCacheEvictionIds(entries, System.currentTimeMillis())
    if (evictions.isEmpty()) return
    entries.filter { it.articleId in evictions }.forEach { entry ->
      dao.delete(userId, entry.articleId)
      deleteRecordFiles(entry)
    }
  }

  private fun deleteRecordFiles(record: OfflineArticle) {
    File(record.localHtmlPath).parentFile?.deleteRecursively()
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
        val replacement = match.value.replace(imgUrl, offlineAssetUrl(articleId, localFile.name))
        result.append(replacement)
      } else {
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
