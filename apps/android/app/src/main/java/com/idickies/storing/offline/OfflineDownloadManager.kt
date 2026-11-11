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
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest
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
    dao.automatic(userId).forEach { refreshAutomaticAssets(userId, it) }
    trimAutomaticCache(userId)
    dao.automaticSize(userId) ?: 0L
  }

  /** 所有未固定自动缓存的文章数量。 */
  suspend fun automaticCacheCount(): Int = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    trimAutomaticCache(userId)
    dao.automaticCount(userId)
  }

  /** 所有自动缓存正文图片数量。 */
  suspend fun automaticImageCount(): Int = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    dao.automatic(userId).forEach { refreshAutomaticAssets(userId, it) }
    dao.automaticImageCount(userId) ?: 0
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

  /** 阅读时优先使用本地正文；正文图片由 WebView 请求拦截器按文章落盘复用。 */
  suspend fun loadForReading(articleId: Int): OfflineReaderContent? = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val record = dao.get(userId, articleId)
      ?.takeIf { it.status == OfflineDownloadStatus.Completed.name }
      ?: return@withContext null
    loadRecord(record)
  }

  /**
   * 在 WebView 首次请求图片时下载并落盘，后续相同图片请求直接读取本地文件。
   * 这是“边读边缓存”，不会在打开文章时额外预取整套图集。
   */
  fun loadReaderImage(
    articleId: Int,
    url: String,
    requestHeaders: Map<String, String>,
  ): WebResourceResponse? = runCatching {
    val uri = Uri.parse(url)
    if (uri.scheme != "http" && uri.scheme != "https") return null
    if (!looksLikeImageRequest(uri, requestHeaders)) return null

    val userId = sessionStore.read()?.userId ?: 0
    val imagesDir = File(articleDirectory(userId, articleId), "images").apply { mkdirs() }
    val prefix = imageCachePrefix(url)
    findCachedImage(imagesDir, prefix)?.let { return imageResponse(it) }

    val requestBuilder = Request.Builder().url(url)
    requestHeaders.forEach { (name, value) ->
      if (name.equals("User-Agent", ignoreCase = true) ||
        name.equals("Referer", ignoreCase = true) ||
        name.equals("Accept", ignoreCase = true)
      ) {
        requestBuilder.header(name, value)
      }
    }
    client.newCall(requestBuilder.build()).execute().use { response ->
      if (!response.isSuccessful) return null
      val body = response.body ?: return null
      val contentType = body.contentType()?.toString()?.substringBefore(';')
        ?.takeIf { it.startsWith("image/", ignoreCase = true) }
        ?: return null
      val bytes = body.bytes()
      if (bytes.size > AUTOMATIC_IMAGE_MAX_SINGLE_BYTES) {
        return WebResourceResponse(contentType, null, ByteArrayInputStream(bytes))
      }
      val stats = imageCacheStats(imagesDir)
      if (stats.count < AUTOMATIC_IMAGE_MAX_COUNT &&
        stats.bytes + bytes.size <= AUTOMATIC_IMAGE_MAX_BYTES
      ) {
        val extension = imageExtension(contentType, uri)
        val target = File(imagesDir, "$prefix.$extension")
        val temporary = File(imagesDir, "tmp_${UUID.randomUUID()}")
        temporary.writeBytes(bytes)
        if (!temporary.renameTo(target)) {
          target.writeBytes(bytes)
          temporary.delete()
        }
      }
      WebResourceResponse(contentType, null, ByteArrayInputStream(bytes))
    }
  }.getOrNull()

  /** 统计自动缓存正文图片数量与总占用；设置页和关闭阅读器时调用。 */
  suspend fun refreshAutomaticAssets(articleId: Int) = withContext(Dispatchers.IO) {
    val userId = prepareUser()
    val record = dao.get(userId, articleId) ?: return@withContext
    refreshAutomaticAssets(userId, record)
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
    val imageStats = imageCacheStats(File(articleDir, "images"))
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
      imageCount = imageStats.count,
      totalSizeBytes = htmlFile.length() + imageStats.bytes,
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

  private val imageExtensions = setOf("jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg")

  private fun articleDirectory(userId: Int, articleId: Int): File =
    File(File(baseDir, "user-$userId"), "article-$articleId")

  private fun looksLikeImageRequest(uri: Uri, headers: Map<String, String>): Boolean {
    val accept = headers.entries
      .firstOrNull { it.key.equals("Accept", ignoreCase = true) }
      ?.value
      .orEmpty()
    if (accept.contains("image/", ignoreCase = true)) return true
    val extension = uri.lastPathSegment
      ?.substringAfterLast('.', "")
      ?.lowercase()
      .orEmpty()
    return extension in imageExtensions
  }

  private fun imageCachePrefix(url: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(url.toByteArray(Charsets.UTF_8))
    return "img_" + digest.joinToString("") { byte ->
      (byte.toInt() and 0xff).toString(16).padStart(2, '0')
    }
  }

  private fun findCachedImage(imagesDir: File, prefix: String): File? =
    imagesDir.listFiles()?.firstOrNull { file ->
      file.isFile && file.name.startsWith("$prefix.")
    }

  private fun imageResponse(file: File): WebResourceResponse {
    val mimeType = MimeTypeMap.getSingleton()
      .getMimeTypeFromExtension(file.extension.lowercase())
      ?: "image/jpeg"
    return WebResourceResponse(mimeType, null, file.inputStream())
  }

  private fun imageCacheStats(imagesDir: File): ImageCacheStats {
    val files = imagesDir.listFiles()?.filter { it.isFile && !it.name.startsWith("tmp_") }.orEmpty()
    return ImageCacheStats(
      count = files.size,
      bytes = files.sumOf { it.length() },
    )
  }

  private fun imageExtension(contentType: String, uri: Uri): String {
    val mimeExtension = MimeTypeMap.getSingleton()
      .getExtensionFromMimeType(contentType)
      ?.lowercase()
      ?.takeIf { it in imageExtensions }
    val urlExtension = uri.lastPathSegment
      ?.substringAfterLast('.', "")
      ?.lowercase()
      ?.takeIf { it in imageExtensions }
    return mimeExtension ?: urlExtension ?: "jpg"
  }

  private suspend fun refreshAutomaticAssets(userId: Int, record: OfflineArticle) {
    if (record.isPinned) return
    val articleDir = File(record.localHtmlPath).parentFile ?: return
    val imageCount = File(articleDir, "images")
      .listFiles()
      ?.count { it.isFile && !it.name.startsWith("tmp_") }
      ?: 0
    val totalSizeBytes = articleDir
      .walkTopDown()
      .filter { it.isFile }
      .sumOf { it.length() }
    if (record.imageCount != imageCount || record.totalSizeBytes != totalSizeBytes) {
      dao.updateAutomaticAssets(userId, record.articleId, imageCount, totalSizeBytes)
    }
  }

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

  private data class ImageCacheStats(
    val count: Int,
    val bytes: Long,
  )
}
