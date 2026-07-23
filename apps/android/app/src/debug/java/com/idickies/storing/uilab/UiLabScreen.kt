package com.idickies.storing.uilab

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import com.idickies.storing.ui.components.QiankunjieArticleCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun UiLabScreen(
  initialScenario: UiLabScenario,
  onClose: () -> Unit,
) {
  var scenarioRoute by rememberSaveable { mutableStateOf(initialScenario.route) }
  val scenario = UiLabScenario.fromRoute(scenarioRoute)
  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("乾坤戒 UI Lab") },
        navigationIcon = { TextButton(onClick = onClose) { Text("关闭") } },
        actions = { Text(scenario.route, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(end = 16.dp)) },
      )
    },
  ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        UiLabScenario.entries.forEach { candidate ->
          FilterChip(
            selected = scenario == candidate,
            onClick = { scenarioRoute = candidate.route },
            label = { Text(candidate.title) },
          )
        }
      }
      when (scenario) {
        UiLabScenario.Library -> UiLabLibrary()
        UiLabScenario.Reader -> UiLabReader()
        UiLabScenario.Share -> UiLabShare()
        UiLabScenario.Tasks -> UiLabTasks()
      }
    }
  }
}

@Composable
private fun UiLabLibrary() {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    item {
      Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
          Text("正在采集 2 条内容", style = MaterialTheme.typography.titleSmall)
          Text("固定进行中状态 · 点击后未来会进入任务页", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
      }
    }
    item { Text("收件箱", style = MaterialTheme.typography.headlineSmall) }
    items(UiLabFixtures.library) { article -> QiankunjieArticleCard(article = article, onOpen = {}) }
  }
}

@Composable
private fun UiLabReader() {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 18.dp),
    verticalArrangement = Arrangement.spacedBy(18.dp),
  ) {
    item {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Storing Design Notes", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Row {
          IconButton(onClick = {}) { Icon(Icons.Outlined.FavoriteBorder, contentDescription = "收藏") }
          IconButton(onClick = {}) { Icon(Icons.Outlined.Archive, contentDescription = "归档") }
          IconButton(onClick = {}) { Icon(Icons.Outlined.IosShare, contentDescription = "分享") }
        }
      }
    }
    item { Text(UiLabFixtures.readerTitle, style = MaterialTheme.typography.headlineMedium) }
    item {
      Box(
        modifier = Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(28.dp)).background(Brush.linearGradient(listOf(Color(0xFF304E59), Color(0xFF91BEB4)))),
        contentAlignment = Alignment.Center,
      ) { Icon(Icons.Outlined.AutoStories, contentDescription = "阅读视觉占位", tint = Color.White, modifier = Modifier.height(54.dp)) }
    }
    item {
      Card { Column(Modifier.padding(18.dp)) {
        Text("AI 摘要", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Text(UiLabFixtures.readerSummary, modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodyLarge)
      } }
    }
    item { Text(UiLabFixtures.readerBody, style = MaterialTheme.typography.bodyLarge) }
  }
}

@Composable
private fun UiLabShare() {
  LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item { Text("从其他应用采集", style = MaterialTheme.typography.headlineSmall) }
    item { Text("用于评审单链接、多链接和错误状态；所有内容都是固定夹具。", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    items(listOf("https://example.com/long-form-article", "https://example.org/another-reading")) { url ->
      Card(modifier = Modifier.fillMaxWidth().clickable { }) { Column(Modifier.padding(16.dp)) { Text("example.com", color = MaterialTheme.colorScheme.primary); Text(url, modifier = Modifier.padding(top = 6.dp)) } }
    }
    item { Card { Text("无有效 URL：未识别到可采集的网页链接", modifier = Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error) } }
  }
}

@Composable
private fun UiLabTasks() {
  LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item { Text("采集任务", style = MaterialTheme.typography.headlineSmall) }
    item { UiLabTaskCard("正在抓取：一篇较长的网页文章标题", "running · capture", null) }
    item { UiLabTaskCard("已完成：知识管理的长期价值", "completed · done", null) }
    item { UiLabTaskCard("采集失败：页面暂时无法访问", "failed · capture", "可在此验证失败原因、重试按钮和后台说明入口。") }
  }
}

@Composable
private fun UiLabTaskCard(title: String, status: String, error: String?) {
  Card(modifier = Modifier.fillMaxWidth()) {
    Column(Modifier.padding(16.dp)) {
      Text(title, style = MaterialTheme.typography.titleMedium)
      Text(status, modifier = Modifier.padding(top = 6.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
      error?.let { Text(it, modifier = Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error) }
    }
  }
}
