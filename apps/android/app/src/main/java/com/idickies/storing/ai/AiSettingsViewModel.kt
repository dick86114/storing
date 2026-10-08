package com.idickies.storing.ai

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AiSettingsForm(
  val provider: String = "deepseek",
  val model: String = "",
  val baseUrl: String? = null,
  val apiKey: String = "",
  val autoTriggerOnArchive: Boolean = false,
)

data class AiSettingsUiState(
  val settings: UserAiSettings? = null,
  val form: AiSettingsForm = AiSettingsForm(),
  val models: List<AiModelOption> = emptyList(),
  val jobs: AiJobsResponse? = null,
  val loading: Boolean = false,
  val saving: Boolean = false,
  val testing: Boolean = false,
  val deleting: Boolean = false,
  val discovering: Boolean = false,
  val notice: String? = null,
  val error: String? = null,
)

@HiltViewModel
class AiSettingsViewModel @Inject constructor(
  private val repository: AiSettingsRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(AiSettingsUiState())
  val state: StateFlow<AiSettingsUiState> = _state.asStateFlow()

  fun load() {
    viewModelScope.launch {
      _state.update { it.copy(loading = true, error = null) }
      try {
        val settings = repository.settings().settings
        val jobs = repository.jobs()
        _state.update { current ->
          current.copy(
            settings = settings,
            jobs = jobs,
            form = AiSettingsForm(
              provider = settings?.provider ?: current.form.provider,
              model = settings?.model ?: "",
              baseUrl = settings?.baseUrl,
              apiKey = "",
              autoTriggerOnArchive = settings?.autoTriggerOnArchive ?: false,
            ),
            loading = false,
          )
        }
      } catch (error: Throwable) {
        _state.update { it.copy(loading = false, error = error.message ?: "加载 AI 配置失败") }
      }
    }
  }

  fun updateForm(transform: (AiSettingsForm) -> AiSettingsForm) {
    _state.update { it.copy(form = transform(it.form)) }
  }

  fun discover() {
    viewModelScope.launch {
      _state.update { it.copy(discovering = true, error = null, notice = null) }
      try {
        val form = _state.value.form
        val response = repository.discover(
          DiscoverAiModelsRequest(form.provider, form.baseUrl, form.apiKey.ifBlank { null }),
        )
        _state.update {
          it.copy(models = response.models, discovering = false, notice = if (response.cached) "已显示缓存的模型列表" else "模型列表已更新")
        }
      } catch (error: Throwable) {
        _state.update { it.copy(discovering = false, models = emptyList(), error = error.message ?: "获取模型列表失败") }
      }
    }
  }

  fun save() {
    viewModelScope.launch {
      _state.update { it.copy(saving = true, error = null, notice = null) }
      try {
        val form = _state.value.form
        val response = repository.save(
          SaveUserAiSettingsRequest(form.provider, form.model, form.baseUrl, form.apiKey.ifBlank { null }, form.autoTriggerOnArchive),
        )
        _state.update {
          it.copy(
            settings = response.settings,
            form = it.form.copy(apiKey = ""),
            saving = false,
            notice = "AI 配置已保存",
          )
        }
      } catch (error: Throwable) {
        _state.update { it.copy(saving = false, error = error.message ?: "保存失败") }
      }
    }
  }

  fun test() {
    viewModelScope.launch {
      _state.update { it.copy(testing = true, error = null, notice = null) }
      try {
        val response = repository.test()
        _state.update { it.copy(testing = false, notice = "AI 连接正常，耗时 ${response.latencyMs}ms") }
      } catch (error: Throwable) {
        _state.update { it.copy(testing = false, error = error.message ?: "AI 连接测试失败") }
      }
    }
  }

  fun delete() {
    viewModelScope.launch {
      _state.update { it.copy(deleting = true, error = null, notice = null) }
      try {
        repository.delete()
        _state.update {
          it.copy(
            settings = null,
            form = AiSettingsForm(),
            deleting = false,
            notice = "AI 配置已删除",
          )
        }
      } catch (error: Throwable) {
        _state.update { it.copy(deleting = false, error = error.message ?: "删除失败") }
      }
    }
  }

  fun retry(jobId: Int) {
    viewModelScope.launch {
      try {
        repository.retry(jobId)
        _state.update { it.copy(notice = "AI 任务已重新排队") }
        load()
      } catch (error: Throwable) {
        _state.update { it.copy(error = error.message ?: "重试失败") }
      }
    }
  }
}
