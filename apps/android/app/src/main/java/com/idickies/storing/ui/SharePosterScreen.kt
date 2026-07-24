package com.idickies.storing.ui

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.share.SharePosterGenerator
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharePosterScreen(
  article: ArticleDetail,
  publicUrl: String,
  onBack: () -> Unit,
) {
  val context = LocalContext.current
  val isDark = MaterialTheme.colorScheme.surface == androidx.compose.ui.graphics.Color(0xFF2E3440)
  var posterBitmap by remember { mutableStateOf<Bitmap?>(null) }
  var isGenerating by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(article.id, publicUrl) {
    isGenerating = true
    error = null
    try {
      posterBitmap = SharePosterGenerator.generate(context, article, publicUrl, isDark)
    } catch (e: Exception) {
      error = e.message ?: "生成失败"
    } finally {
      isGenerating = false
    }
  }

  BackHandler(onBack = onBack)

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("分享海报") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回") } },
      )
    },
    bottomBar = {
      if (posterBitmap != null) {
        PosterActionBar(
          onSave = { savePosterToGallery(context, posterBitmap!!) },
          onShare = { sharePoster(context, posterBitmap!!, article.displayTitle) },
        )
      }
    },
  ) { padding ->
    Box(
      modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 24.dp, vertical = 20.dp),
      contentAlignment = Alignment.Center,
    ) {
      when {
        isGenerating -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
          androidx.compose.material3.CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp)
          Text("正在生成海报…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        error != null -> Text("生成失败：$error", color = MaterialTheme.colorScheme.error)
        posterBitmap != null -> Image(
          bitmap = posterBitmap!!.asImageBitmap(),
          contentDescription = "分享海报预览",
          contentScale = ContentScale.Fit,
          modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
        )
      }
    }
  }
}

@Composable
private fun PosterActionBar(onSave: () -> Unit, onShare: () -> Unit) {
  Surface(color = liquidGlassSurfaceColor()) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      androidx.compose.material3.OutlinedButton(
        onClick = onSave,
        modifier = Modifier.weight(1f),
        contentPadding = PaddingValues(vertical = 12.dp),
      ) {
        Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("保存图片")
      }
      androidx.compose.material3.Button(
        onClick = onShare,
        modifier = Modifier.weight(1f),
        contentPadding = PaddingValues(vertical = 12.dp),
      ) {
        Icon(Icons.Outlined.IosShare, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("分享海报")
      }
    }
  }
}

private fun savePosterToGallery(context: Context, bitmap: Bitmap) {
  val filename = "qiankunjie-${System.currentTimeMillis()}.png"
  val contentValues = ContentValues().apply {
    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
    put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Qiankunjie")
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
  }

  val resolver = context.contentResolver
  val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
  } else {
    MediaStore.Images.Media.EXTERNAL_CONTENT_URI
  }

  val uri = resolver.insert(collection, contentValues) ?: return
  resolver.openOutputStream(uri)?.use { out ->
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
  }

  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    contentValues.clear()
    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
    resolver.update(uri, contentValues, null, null)
  }

  android.widget.Toast.makeText(context, "已保存到相册", android.widget.Toast.LENGTH_SHORT).show()
}

private fun sharePoster(context: Context, bitmap: Bitmap, title: String) {
  val uri = saveBitmapToCache(context, bitmap, title) ?: return
  val intent = Intent(Intent.ACTION_SEND).apply {
    type = "image/png"
    putExtra(Intent.EXTRA_STREAM, uri)
    putExtra(Intent.EXTRA_TEXT, title)
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }
  context.startActivity(Intent.createChooser(intent, "分享海报"))
}

private fun saveBitmapToCache(context: Context, bitmap: Bitmap, title: String): Uri? {
  return try {
    val cacheDir = context.cacheDir
    val file = java.io.File(cacheDir, "share-${title.take(20).replace(Regex("[^a-zA-Z0-9\\u4e00-\\u9fa5]"), "_")}-${System.currentTimeMillis()}.png")
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    // Use FileProvider if available; fallback to file://
    val fileProviderAuthority = "${context.packageName}.fileprovider"
    try {
      androidx.core.content.FileProvider.getUriForFile(context, fileProviderAuthority, file)
    } catch (_: Exception) {
      Uri.fromFile(file)
    }
  } catch (e: Exception) {
    null
  }
}
