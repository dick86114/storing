package com.idickies.storing.ui

import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Brightness4
import androidx.compose.material.icons.outlined.BrightnessAuto
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.ViewModule
import androidx.compose.material.icons.outlined.VerticalAlignTop
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.automirrored.outlined.Sort
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.automirrored.outlined.ViewList
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.idickies.storing.R
import com.idickies.storing.BuildConfig
import com.idickies.storing.collect.CollectJobsViewModel
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.ui.components.ActiveCollectJobsCard
import com.idickies.storing.ui.components.ReaderActionBar
import com.idickies.storing.ui.components.CompactBottomBarItem
import com.idickies.storing.ui.components.QiankunjieCompactBottomBar
import kotlin.math.abs
import kotlinx.coroutines.launch
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.ArticleListPresentationMode
import com.idickies.storing.library.ArticleProcessingAction
import com.idickies.storing.library.PublicationAction
import com.idickies.storing.library.ArchiveSourceFilter
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.LibrarySort
import com.idickies.storing.library.LibraryViewModel
import com.idickies.storing.library.shouldLoadMore
import com.idickies.storing.library.canManageArticle
import com.idickies.storing.library.publicationAction
import com.idickies.storing.library.archiveSourceFilters
import com.idickies.storing.reader.ReaderWebView
import com.idickies.storing.reader.ReaderPreferences
import com.idickies.storing.reader.ReaderPreferencesViewModel
import com.idickies.storing.reader.ReaderColorScheme
import com.idickies.storing.reader.ReaderDocument
import com.idickies.storing.ui.components.QiankunjieArticleCard
import com.idickies.storing.ui.components.QiankunjieCompactArticleRow
import com.idickies.storing.ui.theme.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openPublicId: String? = null,
  onPublicIdOpened: () -> Unit = {},
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  openMcpSettings: Boolean = false,
  onMcpSettingsOpened: () -> Unit = {},
  onManualUpdateCheck: () -> Unit,
  updateChecking: Boolean,
  themeMode: ThemeMode,
  onThemeModeChange: (ThemeMode) -> Unit,
  isAuthenticated: Boolean,
  isAdmin: Boolean,
  biometricAvailable: Boolean,
  biometricEnabled: Boolean,
  onBiometricEnabledChange: (Boolean) -> Unit,
  readerColorScheme: ReaderColorScheme,
  onRequestLogin: () -> Unit,
  onLogout: () -> Unit,
  libraryViewModel: LibraryViewModel = hiltViewModel(),
  collectViewModel: ShareCollectViewModel = hiltViewModel(),
  jobsViewModel: CollectJobsViewModel = hiltViewModel(),
  readerPreferencesViewModel: ReaderPreferencesViewModel = hiltViewModel(),
) {
  val state by libraryViewModel.state.collectAsState()
  val readerPreferences by readerPreferencesViewModel.preferences.collectAsState()
  val collectState by collectViewModel.state.collectAsState()
  val jobsState by jobsViewModel.state.collectAsState()
  val lifecycleOwner = LocalLifecycleOwner.current
  var showTasks by remember { mutableStateOf(false) }
  var showManualCollect by remember { mutableStateOf(false) }
  var showReaderSettings by remember { mutableStateOf(false) }
  var showSharePoster by remember { mutableStateOf(false) }
  var showChangePassword by remember { mutableStateOf(false) }
  var showOfflineContent by remember { mutableStateOf(false) }
  var showMcp by remember { mutableStateOf(false) }
  var showAdmin by remember { mutableStateOf(false) }
  var showDeviceSessions by remember { mutableStateOf(false) }
  var showSettings by remember { mutableStateOf(false) }
  var showAbout by remember { mutableStateOf(false) }
  var moreExpanded by remember { mutableStateOf(false) }
  var presentationMode by rememberSaveable { mutableStateOf(ArticleListPresentationMode.default) }
  val libraryListState = rememberLazyListState()
  var longPressedArticle by remember { mutableStateOf<com.idickies.storing.library.ArticleCard?>(null) }
  val isScrolledDown by remember { derivedStateOf { libraryListState.firstVisibleItemIndex > 0 || libraryListState.firstVisibleItemScrollOffset > 200 } }
  val scope = androidx.compose.runtime.rememberCoroutineScope()
  DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
      when (event) {
        Lifecycle.Event.ON_START -> jobsViewModel.start()
        Lifecycle.Event.ON_STOP -> jobsViewModel.stop()
        else -> Unit
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) jobsViewModel.start()
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
      jobsViewModel.stop()
    }
  }
  LaunchedEffect(Unit) { collectViewModel.resumePendingSubmissions() }
  LaunchedEffect(sharedText) {
    if (sharedText != null) {
      collectViewModel.receiveSharedText(sharedText)
      onSharedTextConsumed()
    }
  }
  LaunchedEffect(openArticleId) {
    if (openArticleId != null) {
      libraryViewModel.open(openArticleId)
      onArticleOpened()
    }
  }
  LaunchedEffect(openPublicId) {
    if (openPublicId != null) {
      libraryViewModel.openByPublicId(openPublicId)
      onPublicIdOpened()
    }
  }
  LaunchedEffect(openMcpSettings) {
    if (openMcpSettings) {
      showMcp = true
      onMcpSettingsOpened()
    }
  }
  LaunchedEffect(isAuthenticated) {
    if (!isAuthenticated && state.view != LibraryView.Published) {
      libraryViewModel.select(LibraryView.Published)
    }
  }
  LaunchedEffect(openCollectJobs) {
    if (openCollectJobs) {
      showTasks = true
      onCollectJobsOpened()
    }
  }

  BackHandler(enabled = showSettings || showReaderSettings || showSharePoster || showChangePassword || showOfflineContent || showMcp || showAdmin || showDeviceSessions || showTasks || showManualCollect) {
    when {
      showReaderSettings -> showReaderSettings = false
      showSharePoster -> showSharePoster = false
      showChangePassword -> showChangePassword = false
      showOfflineContent -> showOfflineContent = false
      showMcp -> showMcp = false
      showAdmin -> showAdmin = false
      showDeviceSessions -> showDeviceSessions = false
      showSettings -> showSettings = false
      showTasks -> showTasks = false
      showManualCollect -> showManualCollect = false
    }
  }

  val detail = state.detail
  val detailError = state.detailError
  when {
    showReaderSettings -> ReaderSettingsScreen(onBack = { showReaderSettings = false })
    showSharePoster && detail != null && detail.publicId != null -> SharePosterScreen(
      article = detail,
      publicUrl = "https://storing.idickies.com/p/${detail.publicId}",
      onBack = { showSharePoster = false },
    )
    showOfflineContent -> OfflineContentScreen(onBack = { showOfflineContent = false })
    showMcp -> McpScreen(onBack = { showMcp = false })
    showAdmin -> AdminScreen(onBack = { showAdmin = false })
    showChangePassword -> ChangePasswordScreen(
      onBack = { showChangePassword = false },
      onPasswordChanged = onLogout,
    )
    showDeviceSessions -> DeviceSessionsScreen(onBack = { showDeviceSessions = false })
    showSettings -> QiankunjieSettingsScreen(
      checkingUpdate = updateChecking,
      themeMode = themeMode,
      onThemeModeChange = onThemeModeChange,
      onCheckUpdate = onManualUpdateCheck,
      onOpenReaderSettings = { showSettings = false; showReaderSettings = true },
      onOpenChangePassword = { showSettings = false; showChangePassword = true },
      onOpenOfflineContent = { showSettings = false; showOfflineContent = true },
      onOpenMcp = { showSettings = false; showMcp = true },
      onOpenAdmin = if (isAdmin) ({ showSettings = false; showAdmin = true }) else null,
      biometricAvailable = biometricAvailable,
      biometricEnabled = biometricEnabled,
      onBiometricEnabledChange = onBiometricEnabledChange,
      onOpenDeviceSessions = { showSettings = false; showDeviceSessions = true },
      onLogout = { showSettings = false; onLogout() },
      onBack = { showSettings = false },
    )
    detail != null -> ArticleReader(
      article = detail,
      onBack = libraryViewModel::closeDetail,
      canManage = canManageArticle(isAuthenticated, state.view),
      readerColorScheme = readerColorScheme,
      readerPreferences = readerPreferences,
      processingAction = state.processingAction,
      permanentDeleting = state.permanentDeleting,
      savedReadingPosition = state.savedReadingPosition,
      isOfflineAvailable = state.isOfflineAvailable,
      downloadingOffline = state.downloadingOffline,
      onFavorite = { libraryViewModel.toggleFavorite(detail) },
      onArchive = { libraryViewModel.toggleArchive(detail) },
      onPublication = { libraryViewModel.togglePublication(detail) },
      onOpenSharePoster = { showSharePoster = true },
      onProcess = { action -> libraryViewModel.processArticle(detail, action) },
      onDownloadOffline = { libraryViewModel.downloadOffline(detail) },
      onDeleteOffline = { libraryViewModel.deleteOffline(detail.id) },
      onDelete = { libraryViewModel.delete(detail) },
      onDeletePermanent = { libraryViewModel.deletePermanent(detail) },
      onSaveReadingPosition = { percentage -> libraryViewModel.saveReadingPosition(detail.id, percentage) },
    )
    state.loadingDetail -> ArticleDetailSkeleton()
    detailError != null -> ErrorPage(detailError, libraryViewModel::closeDetail)
    else -> Scaffold(
      topBar = {
        TopAppBar(
          colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
          title = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
              Image(
                painter = painterResource(R.drawable.brand_logo),
                contentDescription = null,
                modifier = Modifier.size(26.dp),
              )
              Column {
                Text("乾坤戒", style = MaterialTheme.typography.titleLarge)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                  Text(if (state.searchQuery.isBlank()) state.view.label else "搜索结果", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                  if (state.searchQuery.isBlank()) {
                    val total = state.counts?.let { c ->
                      when (state.view) {
                        LibraryView.Inbox -> c.inbox
                        LibraryView.Favorites -> c.favorites
                        LibraryView.Archive -> c.archive
                        LibraryView.Published -> c.published
                      }
                    } ?: 0
                    if (total > 0) {
                      Text("·", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                      Text("$total", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                  }
                }
              }
            }
          },
          actions = {
            if (isAuthenticated) {
              IconButton(onClick = { showManualCollect = true }) {
                Icon(Icons.Outlined.AddLink, contentDescription = "手动采集链接")
              }
              Box {
                IconButton(onClick = { moreExpanded = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "更多") }
                DropdownMenu(expanded = moreExpanded, onDismissRequest = { moreExpanded = false }, containerColor = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
                  DropdownMenuItem(
                    text = { Text("采集任务") },
                    onClick = { moreExpanded = false; showTasks = true },
                    leadingIcon = {
                      BadgedBox(badge = { if (jobsState.activeJobCount > 0) Badge { Text(jobsState.activeJobCount.toString()) } }) {
                        Icon(Icons.Outlined.TaskAlt, contentDescription = null)
                      }
                    },
                  )
                  Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                  ) {
                    Row(
                      horizontalArrangement = Arrangement.spacedBy(8.dp),
                      verticalAlignment = Alignment.CenterVertically,
                    ) {
                      Icon(Icons.Outlined.Brightness4, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                      Text("显示模式", style = MaterialTheme.typography.bodyMedium)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                      ThemeMode.entries.forEach { mode ->
                        IconButton(
                          onClick = { onThemeModeChange(mode) },
                          modifier = Modifier.size(32.dp),
                        ) {
                          Icon(
                            when (mode) {
                              ThemeMode.System -> Icons.Outlined.BrightnessAuto
                              ThemeMode.Light -> Icons.Outlined.LightMode
                              ThemeMode.Dark -> Icons.Outlined.DarkMode
                            },
                            contentDescription = mode.label,
                            tint = if (mode == themeMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                          )
                        }
                      }
                    }
                  }
                  HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), thickness = 0.5.dp)
                  DropdownMenuItem(
                    text = { Text("设置") },
                    onClick = { moreExpanded = false; showSettings = true },
                    leadingIcon = { Icon(Icons.Outlined.Settings, contentDescription = null) },
                  )
                  DropdownMenuItem(
                    text = { Text("检查更新") },
                    onClick = { moreExpanded = false; onManualUpdateCheck() },
                    leadingIcon = { Icon(Icons.Outlined.Sync, contentDescription = null) },
                  )
                  DropdownMenuItem(
                    text = { Text("关于") },
                    onClick = { moreExpanded = false; showAbout = true },
                    leadingIcon = { Icon(Icons.Outlined.Info, contentDescription = null) },
                  )
                }
              }
            } else {
              IconButton(onClick = onRequestLogin) {
                Icon(Icons.Outlined.Person, contentDescription = "登录")
              }
            }
          },
        )
      },
      bottomBar = {
        if (isAuthenticated) {
          QiankunjieCompactBottomBar() {
            LibraryView.entries.forEach { item ->
              val count = state.badgeCounts[item] ?: 0
              CompactBottomBarItem(
                label = item.shortLabel,
                icon = when (item) {
                  LibraryView.Published -> Icons.Outlined.Public
                  LibraryView.Inbox -> Icons.Outlined.Inbox
                  LibraryView.Favorites -> Icons.Outlined.StarBorder
                  LibraryView.Archive -> Icons.Outlined.Inventory2
                },
                selected = state.view == item && state.searchQuery.isBlank(),
                badgeCount = count,
                onClick = {
                if (state.view == item && state.searchQuery.isBlank()) {
                  libraryViewModel.markViewSeen(item)
                  scope.launch { libraryListState.animateScrollToItem(0) }
                } else {
                  libraryViewModel.select(item)
                }
              },
              )
            }
          }
        }
      },
    ) { padding ->
      var swipeStartX by remember { mutableStateOf(0f) }
      Box(
        modifier = Modifier.fillMaxSize().pointerInput(isAuthenticated) {
          if (!isAuthenticated) return@pointerInput
          detectHorizontalDragGestures(
            onDragStart = { offset -> swipeStartX = offset.x },
            onDragEnd = {},
            onHorizontalDrag = { _, dragAmount ->
              val totalDrag = swipeStartX
              if (abs(totalDrag) > 0f && abs(dragAmount) > 60f) {
                val direction = if (dragAmount < 0) 1 else -1
                val current = LibraryView.entries.indexOf(state.view)
                val next = (current + direction).coerceIn(0, LibraryView.entries.lastIndex)
                if (next != current) libraryViewModel.select(LibraryView.entries[next])
                swipeStartX = 0f
              }
            },
          )
        },
      ) {
        LibraryList(
        state = state,
        collectUrls = collectState.urls,
        collectSelectedUrl = collectState.selectedUrl,
        collectSubmitting = collectState.submitting,
        collectMessage = collectState.message,
        activeJobCount = jobsState.activeJobCount,
        onOpenTasks = { showTasks = true },
        onSearch = libraryViewModel::search,
        onSort = libraryViewModel::selectSort,
        onToggleSortOrder = libraryViewModel::toggleSortOrder,
        sortOrder = state.sortOrder,
        presentationMode = presentationMode,
        onPresentationModeChange = { presentationMode = it },
        onArchiveSource = libraryViewModel::selectArchiveSource,
        onRefresh = libraryViewModel::refresh,
        onLoadMore = libraryViewModel::loadMore,
        onOpen = libraryViewModel::open,
        onLongPress = { longPressedArticle = it },
        onSelectCollectUrl = collectViewModel::select,
        onSubmitCollect = collectViewModel::submit,
        listState = libraryListState,
        modifier = Modifier.padding(padding),
        )
      }
    }
  }

  state.processingError?.let { message ->
    AlertDialog(
      onDismissRequest = libraryViewModel::clearProcessingError,
      icon = { Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("文章处理失败") },
      text = { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = libraryViewModel::clearProcessingError) { Text("知道了") } },
    )
  }
  if (showTasks) CollectJobsDialog(
    onDismiss = { showTasks = false },
    onOpenArticle = { id -> showTasks = false; libraryViewModel.open(id) },
    viewModel = jobsViewModel,
  )
  longPressedArticle?.let { article ->
    ArticleLongPressSheet(
      article = article,
      onDismiss = { longPressedArticle = null },
      onFavorite = { libraryViewModel.toggleFavoriteCard(article); longPressedArticle = null },
      onArchive = { libraryViewModel.toggleArchiveCard(article); longPressedArticle = null },
      onDelete = { libraryViewModel.deleteCard(article); longPressedArticle = null },
    )
  }
  if (showManualCollect) ManualCollectDialog(onDismiss = { showManualCollect = false }, viewModel = collectViewModel)
  if (showAbout) AlertDialog(
    onDismissRequest = { showAbout = false },
    icon = { Icon(Icons.Outlined.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("关于乾坤戒") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("乾坤戒 Storing", style = MaterialTheme.typography.titleSmall)
        Text("版本 ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Text("AI 驱动的个人稍后阅读平台，支持智能摘要、自动分类和标签。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
      }
    },
    confirmButton = { TextButton(onClick = { showAbout = false }) { Text("知道了") } },
  )
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun ManualCollectDialog(
  onDismiss: () -> Unit,
  viewModel: ShareCollectViewModel,
) {
  val state by viewModel.state.collectAsState()
  val context = LocalContext.current
  var url by rememberSaveable { mutableStateOf("") }
  val messageColor = if (state.submissionAccepted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
  val sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true)
  androidx.compose.material3.ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surface,
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 36.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.AddLink, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
        Text("采集网页链接", style = MaterialTheme.typography.titleMedium)
      }
      OutlinedTextField(
        value = url,
        onValueChange = { url = it },
        label = { Text("网页链接") },
        leadingIcon = { Icon(Icons.Outlined.Link, contentDescription = null) },
        trailingIcon = {
          IconButton(onClick = {
            val clipboard = context.getSystemService(ClipboardManager::class.java)
            url = clipboard?.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
          }) { Icon(Icons.Outlined.ContentPaste, contentDescription = "从剪贴板粘贴") }
        },
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { if (url.isNotBlank() && !state.submitting) viewModel.submitManual(url) }),
      )
      state.message?.let { message ->
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Icon(
            if (state.submissionAccepted) Icons.Outlined.CheckCircle else Icons.Outlined.ErrorOutline,
            contentDescription = null,
            tint = messageColor,
            modifier = Modifier.size(18.dp),
          )
          Text(message, color = messageColor, style = MaterialTheme.typography.bodySmall)
        }
      }
      Button(
        onClick = { viewModel.submitManual(url) },
        enabled = !state.submitting && url.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 14.dp),
        shape = MaterialTheme.shapes.medium,
      ) {
        Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text(if (state.submitting) "正在提交…" else "一键采集")
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CollectJobsDialog(
  onDismiss: () -> Unit,
  onOpenArticle: (Int) -> Unit,
  viewModel: CollectJobsViewModel,
) {
  val state by viewModel.state.collectAsState()
  val sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true)
  androidx.compose.material3.ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surface,
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          Text("采集任务", style = MaterialTheme.typography.titleMedium)
          if (state.activeJobCount > 0) {
            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.small) {
              Text("${state.activeJobCount} 进行中", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
            }
          }
        }
        if (state.jobs.any { it.isTerminal }) {
          TextButton(onClick = { viewModel.clearFinished() }) {
            Icon(Icons.Outlined.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(4.dp))
            Text("清理已完成", style = MaterialTheme.typography.labelMedium)
          }
        }
      }
      when {
        state.loading -> Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }
        state.error != null && state.jobs.isEmpty() -> Text(state.error ?: "加载失败", color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(20.dp))
        state.jobs.isEmpty() -> EmptyCollectJobs()
        else -> LazyColumn(
          modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp),
          contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          items(state.jobs, key = { it.id }) { job ->
            CompactCollectJobRow(job = job, onRetry = { viewModel.retry(job.id) }, onOpenArticle = { job.articleId?.let(onOpenArticle) })
          }
        }
      }
      Spacer(Modifier.height(24.dp))
    }
  }
}

@Composable
private fun EmptyCollectJobs() {
  Column(
    modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Icon(Icons.Outlined.TaskAlt, contentDescription = null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
    Text("还没有来自 Android 的采集任务", style = MaterialTheme.typography.titleSmall)
    Text("从浏览器或其他应用分享网页后，进度会显示在这里。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
  }
}

@Composable
private fun CompactCollectJobRow(
  job: MobileCollectJob,
  onRetry: () -> Unit,
  onOpenArticle: () -> Unit,
) {
  val status = collectJobStatusPresentation(job.status)
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.small,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(
        status.icon,
        contentDescription = null,
        tint = status.iconColor(),
        modifier = Modifier.size(20.dp),
      )
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(job.title ?: job.normalizedUrl, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
          Text(status.label, style = MaterialTheme.typography.labelSmall, color = status.iconColor())
          Text(collectStageLabel(job.stage), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        job.errorSummary?.let { error ->
          Text(error, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }
      if (job.status == "failed") {
        androidx.compose.material3.IconButton(onClick = onRetry, modifier = Modifier.size(32.dp)) {
          Icon(Icons.Outlined.Replay, contentDescription = "重新采集", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
        }
      }
      if (job.articleId != null) {
        androidx.compose.material3.IconButton(onClick = onOpenArticle, modifier = Modifier.size(32.dp)) {
          Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = "打开文章", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
        }
      }
    }
  }
}

private data class CollectJobStatusPresentation(
  val label: String,
  val icon: ImageVector,
  val tone: CollectJobTone,
) {
  @Composable fun containerColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.surfaceContainerHigh
    CollectJobTone.Success -> MaterialTheme.colorScheme.secondaryContainer
    CollectJobTone.Error -> MaterialTheme.colorScheme.errorContainer
  }

  @Composable fun iconContainerColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.primaryContainer
    CollectJobTone.Success -> MaterialTheme.colorScheme.secondary
    CollectJobTone.Error -> MaterialTheme.colorScheme.error
  }

  @Composable fun iconColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.onPrimaryContainer
    CollectJobTone.Success -> MaterialTheme.colorScheme.onSecondary
    CollectJobTone.Error -> MaterialTheme.colorScheme.onError
  }
}

private enum class CollectJobTone { Progress, Success, Error }

private fun collectJobStatusPresentation(status: String): CollectJobStatusPresentation = when (status) {
  "completed" -> CollectJobStatusPresentation("已保存到收件箱", Icons.Outlined.CheckCircle, CollectJobTone.Success)
  "failed" -> CollectJobStatusPresentation("采集失败", Icons.Outlined.ErrorOutline, CollectJobTone.Error)
  else -> CollectJobStatusPresentation("正在采集", Icons.Outlined.Sync, CollectJobTone.Progress)
}

private fun collectMethodLabel(method: String): String = when (method) {
  "singlefile" -> "SingleFile"
  "reader" -> "Reader API"
  "local" -> "本地兜底"
  else -> method
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleLongPressSheet(
  article: com.idickies.storing.library.ArticleCard,
  onDismiss: () -> Unit,
  onFavorite: () -> Unit,
  onArchive: () -> Unit,
  onDelete: () -> Unit,
) {
  val sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true)
  androidx.compose.material3.ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surface,
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
      Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp))
      androidx.compose.material3.HorizontalDivider()
      Spacer(Modifier.height(4.dp))
      LongPressActionRow(icon = if (article.isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, label = if (article.isFavorited) "取消收藏" else "收藏", tint = MaterialTheme.colorScheme.primary, onClick = onFavorite)
      LongPressActionRow(icon = if (article.isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive, label = if (article.isArchived) "移回收件箱" else "归档", tint = MaterialTheme.colorScheme.primary, onClick = onArchive)
      LongPressActionRow(icon = Icons.Outlined.DeleteOutline, label = "删除", tint = MaterialTheme.colorScheme.error, onClick = onDelete)
    }
  }
}

@Composable
private fun LongPressActionRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
  Row(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 24.dp, vertical = 14.dp),
    horizontalArrangement = Arrangement.spacedBy(16.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
    Text(label, style = MaterialTheme.typography.bodyLarge, color = tint)
  }
}

private fun collectStrategyLabel(strategy: String): String = when (strategy) {
  "full_page" -> "完整页面"
  "article_only" -> "仅正文"
  "auto" -> "自动"
  else -> strategy
}

private fun collectStageLabel(stage: String): String = when (stage.lowercase()) {
  "queued" -> "等待开始"
  "capture", "capturing" -> "正在抓取内容"
  "processing" -> "正在整理文章"
  "summarizing", "summary" -> "正在生成摘要"
  "completed", "done" -> "已完成"
  else -> stage.ifBlank { "等待处理" }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun LibraryList(
  state: com.idickies.storing.library.LibraryUiState,
  collectUrls: List<String>,
  collectSelectedUrl: String?,
  collectSubmitting: Boolean,
  collectMessage: String?,
  activeJobCount: Int,
  onOpenTasks: () -> Unit,
  onSearch: (String) -> Unit,
  onSort: (LibrarySort) -> Unit,
  onToggleSortOrder: () -> Unit,
  sortOrder: String,
  presentationMode: ArticleListPresentationMode,
  onPresentationModeChange: (ArticleListPresentationMode) -> Unit,
  onArchiveSource: (ArchiveSourceFilter) -> Unit,
  onRefresh: () -> Unit,
  onLoadMore: () -> Unit,
  onOpen: (Int) -> Unit,
  onLongPress: (com.idickies.storing.library.ArticleCard) -> Unit,
  onSelectCollectUrl: (String) -> Unit,
  onSubmitCollect: () -> Unit,
  listState: LazyListState,
  modifier: Modifier = Modifier,
) {
  var query by remember(state.searchQuery) { mutableStateOf(state.searchQuery) }
  val lastVisibleItemIndex by remember { derivedStateOf { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 } }
  LaunchedEffect(lastVisibleItemIndex, state.articles.size, state.hasMore, state.loadingMore, state.fromCache) {
    if (!state.loadingMore && !state.fromCache && shouldLoadMore(lastVisibleItemIndex, listState.layoutInfo.totalItemsCount, state.hasMore)) onLoadMore()
  }
  PullToRefreshBox(
    isRefreshing = state.refreshing,
    onRefresh = onRefresh,
    modifier = modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      state = listState,
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
    item {
      var sortExpanded by remember { mutableStateOf(false) }
      var sourceExpanded by remember { mutableStateOf(false) }
      val sourceOptions = archiveSourceFilters(state.archiveSources)
      val sourceCounts = state.archiveSources.associate { it.source to it.count }
      Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
          if (state.view != LibraryView.Published && state.searchQuery.isBlank()) {
            Box {
              AssistChip(
                onClick = { sortExpanded = true },
                label = { Text(state.sort.label) },
                leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Sort, contentDescription = "排序方式", modifier = Modifier.size(16.dp)) },
              )
              DropdownMenu(expanded = sortExpanded, onDismissRequest = { sortExpanded = false }, containerColor = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
                LibrarySort.availableFor(state.view).forEach { sort ->
                  DropdownMenuItem(
                    text = { Text(sort.label) },
                    leadingIcon = { if (sort == state.sort) Icon(Icons.Outlined.CheckCircle, contentDescription = null) },
                    onClick = { sortExpanded = false; onSort(sort) },
                  )
                }
              }
            }
            androidx.compose.material3.IconButton(
              onClick = onToggleSortOrder,
              modifier = Modifier.size(36.dp),
            ) {
              Icon(
                if (sortOrder == "desc") Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward,
                contentDescription = if (sortOrder == "desc") "降序" else "升序",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.primary,
              )
            }
          }
          if (ArchiveSourceFilter.isAvailableFor(state.view, state.searchQuery)) {
            Box {
              AssistChip(
                onClick = { sourceExpanded = true },
                label = { Text(if (state.archiveSourcesLoading) "来源" else state.archiveSource.label) },
                leadingIcon = { Icon(Icons.Outlined.FilterList, contentDescription = "归档来源", modifier = Modifier.size(16.dp)) },
              )
              DropdownMenu(expanded = sourceExpanded, onDismissRequest = { sourceExpanded = false }, containerColor = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
                sourceOptions.forEach { filter ->
                  val count = filter.category?.let(sourceCounts::get)
                  DropdownMenuItem(
                    text = { Text(if (count == null) filter.label else "${filter.label} · $count") },
                    leadingIcon = { if (filter == state.archiveSource) Icon(Icons.Outlined.CheckCircle, contentDescription = null) },
                    onClick = { sourceExpanded = false; onArchiveSource(filter) },
                  )
                }
              }
            }
          }
          AssistChip(
            onClick = {
              onPresentationModeChange(
                if (presentationMode == ArticleListPresentationMode.Card) ArticleListPresentationMode.CompactList else ArticleListPresentationMode.Card,
              )
            },
            label = { Text(presentationMode.label) },
            leadingIcon = {
              Icon(
                if (presentationMode == ArticleListPresentationMode.Card) Icons.Outlined.ViewModule else Icons.AutoMirrored.Outlined.ViewList,
                contentDescription = "切换文章显示方式",
                modifier = Modifier.size(16.dp),
              )
            },
          )
        }
      }
    }
    if (state.view != LibraryView.Published) item {
      OutlinedTextField(
        value = query,
        onValueChange = { query = it; onSearch(it) },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("搜索标题、来源、摘要或标签") },
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = "搜索") },
        trailingIcon = if (query.isNotBlank()) {
          { IconButton(onClick = { query = ""; onSearch("") }) { Icon(Icons.Outlined.Clear, contentDescription = "清空搜索") } }
        } else null,
        shape = MaterialTheme.shapes.medium,
        singleLine = true,
      )
    }
    if (activeJobCount > 0) item {
      ActiveCollectJobsCard(
        activeJobCount = activeJobCount,
        onOpenTasks = onOpenTasks,
      )
    }
    if (collectUrls.isNotEmpty()) {
      item {
        Card { Column(Modifier.padding(16.dp)) {
          Text("分享采集", style = MaterialTheme.typography.titleMedium)
          collectUrls.forEach { url -> Text(if (url == collectSelectedUrl) "✓ $url" else url, modifier = Modifier.fillMaxWidth().clickable { onSelectCollectUrl(url) }.padding(top = 8.dp), maxLines = 1) }
          Button(onClick = onSubmitCollect, enabled = collectSelectedUrl != null && !collectSubmitting, modifier = Modifier.padding(top = 12.dp)) { Text(if (collectSubmitting) "提交中…" else "一键采集") }
          if (collectMessage != null) Text(collectMessage, modifier = Modifier.padding(top = 8.dp))
        } }
      }
    }
    if (state.fromCache) item { Text("当前显示离线缓存，联网后可点刷新获取最新内容。", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    if (state.loading && state.articles.isEmpty()) {
      items(4) { LibrarySkeletonCard() }
    }
    if (state.error != null) item { ErrorPage(state.error, onRefresh) }
    if (!state.loading && !state.searchPending && state.error == null && state.articles.isEmpty()) item { LibraryEmptyState(view = state.view, isSearchResult = state.searchQuery.isNotBlank()) }
    items(state.articles, key = { it.id }) { article ->
      Column {
        when (presentationMode) {
          ArticleListPresentationMode.Card -> QiankunjieArticleCard(article, onOpen, onLongPress)
          ArticleListPresentationMode.CompactList -> QiankunjieCompactArticleRow(article, onOpen, onLongPress)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f), thickness = 0.5.dp)
      }
    }
      if (state.articles.isNotEmpty() && !state.fromCache) item {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
          when {
            state.loadingMore -> InlineLoading("正在加载更多文章…")
            state.loadMoreError != null -> InlineLoadMoreError(message = state.loadMoreError, retry = onLoadMore)
            state.hasMore -> Text("继续上拉加载更多", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 12.dp), style = MaterialTheme.typography.bodySmall)
            else -> Text("你已经看到全部文章了", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 12.dp), style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
  }
}

@Composable
private fun shimmerBrush(): Brush {
  val transition = rememberInfiniteTransition(label = "shimmer")
  val progress by transition.animateFloat(
    initialValue = 0f,
    targetValue = 1f,
    animationSpec = infiniteRepeatable(tween(1500, easing = LinearEasing), RepeatMode.Restart),
    label = "shimmerProgress",
  )
  val base = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f)
  val highlight = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.14f)
  return Brush.linearGradient(
    colors = listOf(base, highlight, base),
    start = Offset(progress * 800 - 400, 0f),
    end = Offset(progress * 800, 0f),
  )
}

@Composable
private fun LibrarySkeletonCard() {
  val brush = shimmerBrush()
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    shape = MaterialTheme.shapes.large,
  ) {
    Column {
      Box(modifier = Modifier.fillMaxWidth().height(156.dp).background(brush))
      Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(modifier = Modifier.fillMaxWidth(0.5f).height(14.dp).background(brush, MaterialTheme.shapes.small))
        Box(modifier = Modifier.fillMaxWidth().height(20.dp).background(brush, MaterialTheme.shapes.small))
        Box(modifier = Modifier.fillMaxWidth(0.9f).height(20.dp).background(brush, MaterialTheme.shapes.small))
        Box(modifier = Modifier.fillMaxWidth(0.7f).height(14.dp).background(brush, MaterialTheme.shapes.small))
      }
    }
  }
}

@Composable
private fun ArticleDetailSkeleton() {
  val brush = shimmerBrush()
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    // 封面图占位
    Box(modifier = Modifier.fillMaxWidth().height(180.dp).background(brush, MaterialTheme.shapes.large))
    // 标题
    Box(modifier = Modifier.fillMaxWidth(0.8f).height(24.dp).background(brush, MaterialTheme.shapes.small))
    Box(modifier = Modifier.fillMaxWidth(0.5f).height(24.dp).background(brush, MaterialTheme.shapes.small))
    // Meta
    Box(modifier = Modifier.fillMaxWidth(0.4f).height(14.dp).background(brush, MaterialTheme.shapes.small))
    Spacer(Modifier.height(8.dp))
    // AI 摘要卡片占位
    Box(modifier = Modifier.fillMaxWidth().height(80.dp).background(brush, MaterialTheme.shapes.medium))
    Spacer(Modifier.height(8.dp))
    // 正文
    repeat(8) { i ->
      Box(modifier = Modifier.fillMaxWidth(if (i == 3 || i == 7) 0.7f else 1f).height(14.dp).background(brush, MaterialTheme.shapes.small))
    }
    Spacer(Modifier.height(8.dp))
    // 小标题
    Box(modifier = Modifier.fillMaxWidth(0.6f).height(18.dp).background(brush, MaterialTheme.shapes.small))
    // 更多正文
    repeat(6) { i ->
      Box(modifier = Modifier.fillMaxWidth(if (i == 5) 0.5f else 1f).height(14.dp).background(brush, MaterialTheme.shapes.small))
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleReader(article: ArticleDetail, canManage: Boolean, readerColorScheme: ReaderColorScheme, readerPreferences: ReaderPreferences, processingAction: ArticleProcessingAction?, permanentDeleting: Boolean, savedReadingPosition: Float?, isOfflineAvailable: Boolean, downloadingOffline: Boolean, onBack: () -> Unit, onFavorite: () -> Unit, onArchive: () -> Unit, onPublication: () -> Unit, onOpenSharePoster: () -> Unit, onProcess: (ArticleProcessingAction) -> Unit, onDownloadOffline: () -> Unit, onDeleteOffline: () -> Unit, onDelete: () -> Unit, onDeletePermanent: () -> Unit, onSaveReadingPosition: (Float) -> Unit) {
  val context = LocalContext.current
  var confirmDelete by remember { mutableStateOf(false) }
  var confirmPermanentDelete by remember { mutableStateOf(false) }
  var confirmPublication by remember { mutableStateOf<PublicationAction?>(null) }
  var confirmProcessing by remember { mutableStateOf<ArticleProcessingAction?>(null) }
  var moreExpanded by remember { mutableStateOf(false) }
  BackHandler(onBack = onBack)
  val publicUrl = article.publicId?.let { "https://storing.idickies.com/p/$it" }

  fun shareOriginalUrl() {
    article.originalUrl?.let { url ->
      context.startActivity(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url))
    }
  }

  fun copyPublicUrl() {
    publicUrl?.let { url ->
      val clipboard = context.getSystemService(ClipboardManager::class.java)
      val clip = android.content.ClipData.newUri(context.contentResolver, "公开链接", Uri.parse(url))
      clipboard?.setPrimaryClip(clip)
      android.widget.Toast.makeText(context, "公开链接已复制", android.widget.Toast.LENGTH_SHORT).show()
    }
  }

  fun sharePublicUrl() {
    publicUrl?.let { url ->
      val intent = Intent(Intent.ACTION_SEND).setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, url)
        .putExtra(Intent.EXTRA_SUBJECT, article.displayTitle)
      context.startActivity(Intent.createChooser(intent, "分享公开链接"))
    }
  }
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        title = {
          Text(article.source ?: "乾坤戒阅读", style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库") } },
        actions = {
          IconButton(
            onClick = { article.originalUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } },
            enabled = !article.originalUrl.isNullOrBlank(),
          ) { Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = "打开原网页") }
          Box {
            IconButton(onClick = { moreExpanded = true }, enabled = processingAction == null) { Icon(Icons.Outlined.MoreVert, contentDescription = "更多阅读操作") }
            DropdownMenu(expanded = moreExpanded, onDismissRequest = { moreExpanded = false }, containerColor = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
              DropdownMenuItem(
                text = { Text("分享原网页") },
                onClick = { moreExpanded = false; shareOriginalUrl() },
                leadingIcon = { Icon(Icons.Outlined.IosShare, contentDescription = null) },
                enabled = !article.originalUrl.isNullOrBlank(),
              )
              if (article.isPublished && publicUrl != null) DropdownMenuItem(
                text = { Text("复制公开链接") },
                onClick = { moreExpanded = false; copyPublicUrl() },
                leadingIcon = { Icon(Icons.Outlined.Link, contentDescription = null) },
              )
              if (article.isPublished && publicUrl != null) DropdownMenuItem(
                text = { Text("分享公开链接") },
                onClick = { moreExpanded = false; sharePublicUrl() },
                leadingIcon = { Icon(Icons.Outlined.IosShare, contentDescription = null) },
              )
              if (article.isPublished && publicUrl != null) DropdownMenuItem(
                text = { Text("生成分享海报") },
                onClick = { moreExpanded = false; onOpenSharePoster() },
                leadingIcon = { Icon(Icons.Outlined.Image, contentDescription = null) },
              )
              if (canManage) DropdownMenuItem(
                text = { Text(if (article.isFavorited) "取消收藏" else "收藏") },
                onClick = { moreExpanded = false; onFavorite() },
                leadingIcon = { Icon(if (article.isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = null) },
              )
              if (canManage) DropdownMenuItem(
                text = { Text(if (article.isArchived) "移回收件箱" else "归档") },
                onClick = { moreExpanded = false; onArchive() },
                leadingIcon = { Icon(if (article.isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive, contentDescription = null) },
              )
              if (canManage) DropdownMenuItem(
                text = { Text(publicationAction(article.isPublished).label) },
                onClick = { moreExpanded = false; confirmPublication = publicationAction(article.isPublished) },
                leadingIcon = { Icon(Icons.Outlined.Public, contentDescription = null) },
              )
              if (canManage) ArticleProcessingAction.entries.forEach { action ->
                DropdownMenuItem(
                  text = { Text(action.label) },
                  onClick = { moreExpanded = false; confirmProcessing = action },
                  leadingIcon = { Icon(if (action == ArticleProcessingAction.Refetch) Icons.Outlined.Replay else Icons.Outlined.Sync, contentDescription = null) },
                )
              }
              if (canManage) DropdownMenuItem(
                text = { Text("删除", color = MaterialTheme.colorScheme.error) },
                onClick = { moreExpanded = false; confirmDelete = true },
                leadingIcon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
              )
              if (canManage && !downloadingOffline) {
                if (isOfflineAvailable) {
                  DropdownMenuItem(
                    text = { Text("删除离线内容") },
                    onClick = { moreExpanded = false; onDeleteOffline() },
                    leadingIcon = { Icon(Icons.Outlined.CloudOff, contentDescription = null) },
                  )
                } else {
                  DropdownMenuItem(
                    text = { Text("下载离线内容") },
                    onClick = { moreExpanded = false; onDownloadOffline() },
                    leadingIcon = { Icon(Icons.Outlined.CloudDownload, contentDescription = null) },
                    enabled = !article.contentHtml.isNullOrBlank(),
                  )
                }
              }
              if (canManage) DropdownMenuItem(
                text = { Text("永久删除", color = MaterialTheme.colorScheme.error) },
                onClick = { moreExpanded = false; confirmPermanentDelete = true },
                leadingIcon = { Icon(Icons.Outlined.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
              )
            }
          }
        },
      )
    },
    bottomBar = {
      if (canManage && processingAction == null) ReaderActionBar(
        originalUrl = article.originalUrl,
        isFavorited = article.isFavorited,
        isArchived = article.isArchived,
        shareEnabled = !article.originalUrl.isNullOrBlank(),
        onOpenOriginal = { article.originalUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } },
        onFavorite = onFavorite,
        onArchive = onArchive,
        onShare = ::shareOriginalUrl,
      )
      if (canManage && processingAction != null) {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
          Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            Text("正在${processingAction.label}，请稍候…", style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
      if (downloadingOffline) {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
          Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            Text("正在下载离线内容…", style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
    },
  ) { padding ->
    val html = article.contentHtml
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
      if (!html.isNullOrBlank()) {
        key(readerColorScheme, readerPreferences) {
          var currentScrollPercentage by remember { mutableStateOf(0f) }
          var webLoaded by remember { mutableStateOf(false) }
          val headerHtml = ReaderDocument.buildArticleHeader(article, readerColorScheme, isOfflineAvailable)
          // Fallback: ensure skeleton disappears even if onPageCommitVisible doesn't fire
          LaunchedEffect(article.id) {
            kotlinx.coroutines.delay(3000)
            webLoaded = true
          }
          Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            AndroidView(
              factory = { webContext ->
                android.webkit.WebView(webContext).apply {
                  ReaderWebView.configure(
                    this,
                    readerPreferences,
                    onOpenExternalUrl = { uri -> webContext.startActivity(Intent(Intent.ACTION_VIEW, uri)) },
                    onPageFinished = {
                      savedReadingPosition?.let { pos -> ReaderWebView.restoreScrollPosition(this, pos) }
                    },
                    onPageCommitVisible = { webLoaded = true },
                    onScrollChanged = { percentage -> currentScrollPercentage = percentage },
                  )
                  ReaderWebView.loadCapturedHtml(this, html, readerColorScheme, readerPreferences, headerHtml)
                }
              },
              modifier = Modifier.fillMaxSize(),
            )
            if (!webLoaded) {
              Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
                ArticleDetailSkeleton()
              }
            }
          }
          androidx.compose.runtime.DisposableEffect(article.id) {
            onDispose { onSaveReadingPosition(currentScrollPercentage) }
          }
        }
      } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(horizontal = 22.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
      ) {
        item {
          Text(article.source ?: "已保存文章", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
          Text(article.displayTitle, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 8.dp))
        }
        article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
          item {
            Card(colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
              Column(Modifier.padding(18.dp)) {
                Text("AI 摘要", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(summary, modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
              }
            }
          }
        }
        item { Text(article.contentMd?.takeIf { it.isNotBlank() } ?: "正文暂时不可用", style = MaterialTheme.typography.bodyLarge) }
      }
      }
    }
  }
  confirmProcessing?.let { action ->
    AlertDialog(
      onDismissRequest = { confirmProcessing = null },
      icon = { Icon(if (action == ArticleProcessingAction.Refetch) Icons.Outlined.Replay else Icons.Outlined.Sync, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text(action.confirmationTitle) },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
          Text(action.confirmationMessage, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      },
      confirmButton = { Button(onClick = { confirmProcessing = null; onProcess(action) }) { Text(action.label) } },
      dismissButton = { TextButton(onClick = { confirmProcessing = null }) { Text("取消") } },
    )
  }
  confirmPublication?.let { action ->
    AlertDialog(
      onDismissRequest = { confirmPublication = null },
      icon = { Icon(Icons.Outlined.Public, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text(action.confirmationTitle) },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
          Text(action.confirmationMessage, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      },
      confirmButton = { Button(onClick = { confirmPublication = null; onPublication() }) { Text(action.label) } },
      dismissButton = { TextButton(onClick = { confirmPublication = null }) { Text("取消") } },
    )
  }
  if (confirmDelete) AlertDialog(
    onDismissRequest = { confirmDelete = false },
    icon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
    title = { Text("从资料库删除？") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text("删除后将不再显示在你的资料库中；此操作不会影响原网页。", color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    },
    confirmButton = { Button(onClick = { confirmDelete = false; onDelete() }, colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text("确认删除") } },
    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("保留文章") } },
  )
  if (confirmPermanentDelete) AlertDialog(
    onDismissRequest = { confirmPermanentDelete = false },
    icon = { Icon(Icons.Outlined.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
    title = { Text("永久删除这篇文章？") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text("永久删除会彻底清除文章正文和元数据，无法恢复。", color = MaterialTheme.colorScheme.error)
        Text("普通删除只是从你的资料库移除，服务器上的原始文章仍会保留。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    },
    confirmButton = { Button(onClick = { confirmPermanentDelete = false; onDeletePermanent() }, enabled = !permanentDeleting, colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text(if (permanentDeleting) "正在删除…" else "永久删除") } },
    dismissButton = { TextButton(onClick = { confirmPermanentDelete = false }) { Text("取消") } },
  )
}

@Composable
private fun LibraryEmptyState(view: LibraryView, isSearchResult: Boolean) {
  val (_, title, message) = if (isSearchResult) {
    Triple(Icons.Outlined.ErrorOutline, "没有匹配的文章", "试试更短的关键词，或切换到其他资料库。")
  } else when (view) {
    LibraryView.Inbox -> Triple(Icons.Outlined.Inbox, "收件箱还是空的", "从浏览器、微信或其他应用分享网页到乾坤戒，内容会出现在这里。")
    LibraryView.Favorites -> Triple(Icons.Outlined.StarBorder, "还没有收藏", "在阅读器中点按收藏图标，就能把文章留在这里。")
    LibraryView.Archive -> Triple(Icons.Outlined.Inventory2, "归档资料库为空", "归档后的文章会被整理到这里，随时可以移回收件箱。")
    LibraryView.Published -> Triple(Icons.Outlined.Public, "暂时还没有公开文章", "发布后的文章会出现在这里，任何人都可以阅读。")
  }
  Column(
    modifier = Modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    val darkTheme = MaterialTheme.colorScheme.background.luminance() < 0.5f
    Image(
      painter = painterResource(if (darkTheme) R.drawable.empty_library_dark else R.drawable.empty_library_light),
      contentDescription = null,
      modifier = Modifier.fillMaxWidth(0.6f).aspectRatio(1f),
    )
    Text(title, style = MaterialTheme.typography.titleMedium)
    Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.fillMaxWidth())
  }
}

@Composable
private fun InlineLoading(message: String) = Row(
  modifier = Modifier.padding(vertical = 16.dp),
  horizontalArrangement = Arrangement.spacedBy(10.dp),
  verticalAlignment = Alignment.CenterVertically,
) {
  CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
  Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun InlineLoadMoreError(message: String, retry: () -> Unit) = Column(
  horizontalAlignment = Alignment.CenterHorizontally,
  verticalArrangement = Arrangement.spacedBy(6.dp),
) {
  Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
  TextButton(onClick = retry) { Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(6.dp)); Text("重试加载更多") }
}

@Composable
private fun ErrorPage(message: String, retry: () -> Unit) = Surface(
  modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp, horizontal = 4.dp),
  color = MaterialTheme.colorScheme.errorContainer,
  shape = MaterialTheme.shapes.large,
) {
  Column(
    modifier = Modifier.padding(22.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp))
    Text("暂时无法加载", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
    Text(message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
    Button(onClick = retry) { Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(6.dp)); Text("重新尝试") }
  }
}
