package com.idickies.storing.network

import com.idickies.storing.library.DeepAnalysisSummary
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeepAnalysisSubmitResponse(
  @SerialName("articleId") val articleId: Int,
  val jobId: Int,
  val status: String,
)

@Serializable
data class DeepAnalysisRestoreResponse(
  @SerialName("articleId") val articleId: Int,
  val version: Int,
  val summary: DeepAnalysisSummary? = null,
)
