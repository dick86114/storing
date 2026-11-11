package com.idickies.storing.offline

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.auth.SessionTokens
import com.idickies.storing.database.ArticleCacheDatabase
import com.idickies.storing.library.ArticleDetail
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest

@RunWith(AndroidJUnit4::class)
class OfflineArticleCacheTest {
  private lateinit var database: ArticleCacheDatabase
  private lateinit var manager: OfflineDownloadManager
  private lateinit var cacheDirectory: File

  private val sessionStore = object : SessionStore {
    private val tokens = SessionTokens(
      accessToken = "access",
      accessTokenExpiresAtEpochMs = Long.MAX_VALUE,
      refreshToken = "refresh",
      refreshTokenExpiresAtEpochMs = Long.MAX_VALUE,
      userId = 7,
    )

    override fun read(): SessionTokens = tokens
    override fun write(tokens: SessionTokens) = Unit
    override fun clear() = Unit
  }

  @Before
  fun setUp() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    cacheDirectory = File(context.filesDir, "offline_articles")
    cacheDirectory.deleteRecursively()
    database = Room.inMemoryDatabaseBuilder(context, ArticleCacheDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    manager = OfflineDownloadManager(
      context = context,
      dao = database.offlineArticleDao(),
      sessionStore = sessionStore,
      json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
      },
    )
  }

  @After
  fun tearDown() {
    database.close()
    cacheDirectory.deleteRecursively()
  }

  @Test
  fun automaticCacheRestoresDetailAndPinnedOfflineSaveReplacesIt() = runBlocking {
    val article = ArticleDetail(
      id = 901,
      title = "自动缓存文章",
      source = "微信公众号",
      author = "作者",
      aiSummary = "缓存摘要",
      aiTags = listOf("Android"),
      isFavorited = true,
      contentHtml = "<article><p>自动缓存正文</p></article>",
    )

    val cached = manager.saveAutomatic(article)

    assertNotNull(cached)
    assertFalse(cached!!.isPinned)
    assertFalse(cached.hasCompleteAssets)
    assertFalse(manager.isPinned(article.id))
    val restored = manager.loadForReading(article.id)
    assertNotNull(restored)
    assertEquals("<article><p>自动缓存正文</p></article>", restored!!.contentHtml)
    assertEquals("缓存摘要", restored.detail?.aiSummary)
    assertEquals(listOf("Android"), restored.detail?.aiTags)

    val articleDir = File(restored.article.localHtmlPath).parentFile!!
    val imagesDir = File(articleDir, "images").apply { mkdirs() }
    File(imagesDir, "img_existing.jpg").writeBytes(byteArrayOf(1, 2, 3))
    manager.refreshAutomaticAssets(article.id)
    assertEquals(1, manager.automaticImageCount())
    assertTrue(manager.automaticCacheSize() > restored.article.totalSizeBytes)

    val imageUrl = "https://cdn.example.com/reader.jpg"
    val imageDigest = MessageDigest.getInstance("SHA-256")
      .digest(imageUrl.toByteArray())
      .joinToString("") { byte -> (byte.toInt() and 0xff).toString(16).padStart(2, '0') }
    File(imagesDir, "img_$imageDigest.jpg").writeBytes(byteArrayOf(4, 5, 6))
    val cachedImage = manager.loadReaderImage(article.id, imageUrl, mapOf("Accept" to "image/jpeg"))
    assertNotNull(cachedImage)
    assertEquals(listOf<Byte>(4, 5, 6), cachedImage!!.data.readBytes().toList())

    manager.download(
      article = article,
      html = "<article><p>固定离线正文</p></article>",
      coverUrl = null,
    )

    assertTrue(manager.isPinned(article.id))
    assertEquals(1, manager.pinnedArticles().size)
    val pinned = manager.loadPinnedForReading(article.id)
    assertEquals("<article><p>固定离线正文</p></article>", pinned?.contentHtml)

    manager.clearPinned()

    assertFalse(manager.isPinned(article.id))
    assertTrue(manager.pinnedArticles().isEmpty())
  }
}
