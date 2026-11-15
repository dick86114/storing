package com.idickies.storing.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.DeepAnalysisReport
import com.idickies.storing.library.DeepAnalysisReportRecord

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeepAnalysisSheet(
  articleTitle: String,
  articleSource: String?,
  articleAuthor: String?,
  articlePublishTime: String?,
  articleCoverImage: String?,
  report: DeepAnalysisReport?,
  record: DeepAnalysisReportRecord?,
  statusText: String,
  offline: Boolean,
  loading: Boolean,
  errorMessage: String?,
  deleting: Boolean,
  onDismiss: () -> Unit,
  onGenerate: () -> Unit,
  onRetry: () -> Unit,
  onReload: () -> Unit,
  onDelete: () -> Unit,
) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.background,
    dragHandle = {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(26.dp),
        contentAlignment = Alignment.Center,
      ) {
        Box(
          modifier = Modifier
            .width(38.dp)
            .height(4.dp)
            .background(
              MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.32f),
              RoundedCornerShape(999.dp),
            ),
        )
      }
    },
  ) {
    DeepAnalysisReportContent(
      article = DeepAnalysisArticleContext(
        title = articleTitle,
        source = articleSource,
        author = articleAuthor,
        publishTime = articlePublishTime,
        coverImage = articleCoverImage,
      ),
      report = report,
      record = record,
      statusText = statusText,
      offline = offline,
      loading = loading,
      errorMessage = errorMessage,
      deleting = deleting,
      onDismiss = onDismiss,
      onGenerate = onGenerate,
      onRetry = onRetry,
      onReload = onReload,
      onDelete = onDelete,
    )
  }
}
