package com.idickies.storing.network

import com.idickies.storing.update.AndroidRelease
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface MobileReleaseApi {
  @GET("mobile/releases/latest")
  suspend fun latest(@Query("versionCode") versionCode: Int): Response<AndroidRelease>
}
