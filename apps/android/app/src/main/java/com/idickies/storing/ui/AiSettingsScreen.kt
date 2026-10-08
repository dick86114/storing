package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.ai.aiStatusText
import com.idickies.storing.ai.AiModelOption
import com.idickies.storing.ai.AiSettingsViewModel

private val AI_PROVIDERS = listOf(
  "anthropic" to "Anthropic",
  "deepseek" to "DeepSeek",
  "zhipu" to "智谱 AI",
  "minimax" to "MiniMax",
  "kimi" to "Kimi",
  "doubao" to "豆包",
  "openrouter" to "OpenRouter",
  "nvidia" to "NVIDIA",
  "aliyun" to "阿里云",
  "siliconflow" to "SiliconFlow",
  "custom" to "自定义",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiSettingsScreen(
  onBack: () -> Unit,
  viewModel: AiSettingsViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var showApiKey by remember { mutableStateOf(false) }
  var confirmDelete by remember { mutableStateOf(false) }

  LaunchedEffect(Unit) { viewModel.load() }
  BackHandler(onBack = onBack)

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        title = { Text("AI 模型") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
      )
    },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item { Text("按账号配置模型，归档时按设置触发生成。", color = MaterialTheme.colorScheme.onSurfaceVariant) }
      state.notice?.let { item { Text(it, color = MaterialTheme.colorScheme.primary) } }
      state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }

      item {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          OutlinedTextField(
            value = state.form.provider,
            onValueChange = { viewModel.updateForm { it.copy(provider = "custom") } },
            label = { Text("模型提供商") },
            readOnly = true,
            trailingIcon = { Text("选择") },
            modifier = Modifier.fillMaxWidth(),
          )
          androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AI_PROVIDERS.forEach { (value, label) ->
              FilterChip(
                selected = state.form.provider == value,
                onClick = { viewModel.updateForm { it.copy(provider = value) } },
                label = { Text(label) },
              )
            }
          }
          OutlinedTextField(
            value = state.form.baseUrl.orEmpty(),
            onValueChange = { value -> viewModel.updateForm { it.copy(baseUrl = value.ifBlank { null }) } },
            label = { Text("Base URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = state.form.apiKey,
            onValueChange = { value -> viewModel.updateForm { it.copy(apiKey = value) } },
            label = { Text("API Key") },
            placeholder = {
              Text(
                if (state.settings?.apiKeyConfigured == true) {
                  "已配置 ${state.settings?.apiKeyLast4.orEmpty()}"
                } else {
                  "输入 API Key"
                },
              )
            },
            singleLine = true,
            visualTransformation = if (showApiKey) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
              IconButton(onClick = { showApiKey = !showApiKey }) {
                Icon(if (showApiKey) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, contentDescription = null)
              }
            },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = state.form.model,
            onValueChange = { value -> viewModel.updateForm { it.copy(model = value) } },
            label = { Text("模型") },
            placeholder = { Text("选择或手动输入模型名") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
          )
          if (state.models.isNotEmpty()) {
            androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              state.models.take(12).forEach { model: AiModelOption ->
                FilterChip(
                  selected = state.form.model == model.id,
                  onClick = { viewModel.updateForm { it.copy(model = model.id) } },
                  label = { Text(model.name ?: model.id, maxLines = 1) },
                )
              }
            }
          }
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Switch(checked = state.form.autoTriggerOnArchive, onCheckedChange = { checked -> viewModel.updateForm { it.copy(autoTriggerOnArchive = checked) } })
            Text("自动触发")
          }
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = viewModel::save, enabled = !state.saving && !state.loading) {
              Text(if (state.saving) "保存中..." else "保存配置")
            }
            OutlinedButton(onClick = viewModel::discover, enabled = !state.discovering && !state.loading) {
              Text(if (state.discovering) "获取中..." else "获取模型")
            }
            OutlinedButton(onClick = viewModel::test, enabled = !state.testing && !state.loading) {
              Text(if (state.testing) "测试中..." else "测试生成")
            }
            TextButton(
              onClick = { confirmDelete = true },
              enabled = !state.deleting && !state.loading,
            ) { Text("删除配置", color = MaterialTheme.colorScheme.error) }
          }
        }
      }

      item { Text("最近任务", style = MaterialTheme.typography.titleMedium) }
      state.jobs?.let { jobs ->
        item {
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("共 ${jobs.usage.totalJobs} 次", style = MaterialTheme.typography.bodySmall)
            Text("成功 ${jobs.usage.succeededJobs}", style = MaterialTheme.typography.bodySmall)
            Text("失败 ${jobs.usage.failedJobs}", style = MaterialTheme.typography.bodySmall)
            Text("Token ${jobs.usage.totalTokens}", style = MaterialTheme.typography.bodySmall)
          }
        }
        items(jobs.jobs) { aiJob ->
          Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text("#${aiJob.id} · 文章 ${aiJob.articleId}", style = MaterialTheme.typography.titleSmall)
            Text(aiJob.model ?: "—", style = MaterialTheme.typography.bodySmall)
            Text(aiStatusText(aiJob.status), style = MaterialTheme.typography.bodySmall)
            aiJob.totalTokens?.let { Text("$it tokens", style = MaterialTheme.typography.bodySmall) }
            if (aiJob.status == "failed") {
              TextButton(onClick = { viewModel.retry(aiJob.id) }) { Text("重试") }
            }
          }
        }
      }
      if (state.loading) item { CircularProgressIndicator() }
    }
  }

  if (confirmDelete) {
    androidx.compose.material3.AlertDialog(
      onDismissRequest = { confirmDelete = false },
      title = { Text("删除 AI 配置") },
      text = { Text("确定删除 AI 配置？删除后归档将不再自动生成。") },
      confirmButton = {
        TextButton(onClick = { confirmDelete = false; viewModel.delete() }) { Text("删除") }
      },
      dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("取消") } },
    )
  }
}
