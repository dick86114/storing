package com.idickies.storing.di

import android.content.Context
import com.idickies.storing.ApiConfiguration
import com.idickies.storing.BuildConfig
import com.idickies.storing.auth.DeviceIdentityProvider
import com.idickies.storing.auth.KeystoreSessionStore
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.database.ArticleCacheDatabase
import com.idickies.storing.network.AccessTokenInterceptor
import com.idickies.storing.network.ClientHeadersInterceptor
import com.idickies.storing.network.ArticleApi
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileReleaseApi
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import com.idickies.storing.network.KotlinxSerializationFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
  @Provides
  @Singleton
  fun provideDeviceIdentityProvider(@ApplicationContext context: Context) = DeviceIdentityProvider(context)

  @Provides
  @Singleton
  fun provideSessionStore(@ApplicationContext context: Context): SessionStore = KeystoreSessionStore(context)

  @Provides
  @Singleton
  fun provideArticleCacheDatabase(@ApplicationContext context: Context): ArticleCacheDatabase =
    ArticleCacheDatabase.create(context)

  @Provides
  fun provideArticleCacheDao(database: ArticleCacheDatabase) = database.articleCacheDao()

  @Provides
  fun providePendingCollectSubmissionDao(database: ArticleCacheDatabase) = database.pendingCollectSubmissionDao()

  @Provides
  @Singleton
  fun provideJson(): Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

  @Provides
  @Singleton
  fun provideOkHttpClient(deviceIdentityProvider: DeviceIdentityProvider, sessionStore: SessionStore): OkHttpClient =
    OkHttpClient.Builder()
      .addInterceptor(ClientHeadersInterceptor(deviceIdentityProvider))
      .addInterceptor(AccessTokenInterceptor(sessionStore))
      .apply {
        if (BuildConfig.ENABLE_NETWORK_LOGGING) {
          addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
        }
      }
      .build()

  @Provides
  @Singleton
  fun provideRetrofit(okHttpClient: OkHttpClient, json: Json): Retrofit =
    Retrofit.Builder()
      .baseUrl(ApiConfiguration.baseUrl)
      .client(okHttpClient)
      .addConverterFactory(KotlinxSerializationFactory.create(json))
      .build()

  @Provides
  @Singleton
  fun provideMobileAuthApi(retrofit: Retrofit): MobileAuthApi = retrofit.create(MobileAuthApi::class.java)

  @Provides
  @Singleton
  fun provideMobileReleaseApi(retrofit: Retrofit): MobileReleaseApi = retrofit.create(MobileReleaseApi::class.java)

  @Provides
  @Singleton
  fun provideArticleApi(retrofit: Retrofit): ArticleApi = retrofit.create(ArticleApi::class.java)

  @Provides
  @Singleton
  fun provideMobileCollectApi(retrofit: Retrofit): MobileCollectApi = retrofit.create(MobileCollectApi::class.java)
}


@Module
@InstallIn(SingletonComponent::class)
abstract class AuthBindingsModule {
  @Binds
  @Singleton
  abstract fun bindMobileSessionAuthenticator(authRepository: com.idickies.storing.auth.AuthRepository): com.idickies.storing.auth.MobileSessionAuthenticator
}
