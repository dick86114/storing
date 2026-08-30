import com.android.build.gradle.internal.api.BaseVariantOutputImpl

val defaultAppVersionName = "0.7.0"
val defaultAppVersionCode = 7
val configuredAppVersionName = providers.gradleProperty("qiankunjieVersionName")
  .orElse(providers.environmentVariable("QIANKUNJIE_VERSION_NAME"))
  .orNull
val configuredAppVersionCode = providers.gradleProperty("qiankunjieVersionCode")
  .orElse(providers.environmentVariable("QIANKUNJIE_VERSION_CODE"))
  .orNull
val appVersionName = configuredAppVersionName?.trim().takeUnless { it.isNullOrBlank() } ?: defaultAppVersionName
val appVersionCode = configuredAppVersionCode?.toIntOrNull()?.takeIf { it > 0 }
  ?: if (configuredAppVersionCode == null) defaultAppVersionCode else error("QIANKUNJIE_VERSION_CODE 必须为正整数")

val releaseStoreFile = providers.environmentVariable("QIANKUNJIE_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("QIANKUNJIE_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("QIANKUNJIE_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("QIANKUNJIE_RELEASE_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
  alias(libs.plugins.hilt)
  alias(libs.plugins.ksp)
}

android {
  namespace = "com.idickies.storing"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.idickies.storing"
    minSdk = 31
    targetSdk = 36
    versionCode = appVersionCode
    versionName = appVersionName

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    buildConfigField("String", "API_BASE_URL", "\"https://storing.idickies.cc/api/v1/\"")
    // All build types must define this field; Debug overrides it below.
    buildConfigField("boolean", "ENABLE_NETWORK_LOGGING", "false")
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("qiankunjieRelease") {
        storeFile = file(releaseStoreFile!!)
        storePassword = releaseStorePassword
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
      }
    }
  }

  buildTypes {
    release {
      if (hasReleaseSigning) signingConfig = signingConfigs.getByName("qiankunjieRelease")
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
    debug {
      applicationIdSuffix = ".debug"
      versionNameSuffix = "-debug"
      buildConfigField("boolean", "ENABLE_NETWORK_LOGGING", "true")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    buildConfig = true
    compose = true
  }

  packaging {
    resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
  }
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime)
  implementation(libs.androidx.lifecycle.viewmodel)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.navigation.compose)
  implementation(platform(libs.compose.bom))
  implementation(libs.compose.ui)
  implementation(libs.compose.ui.graphics)
  implementation(libs.compose.ui.tooling.preview)
  implementation(libs.compose.material3)
  implementation(libs.compose.material.icons.extended)
  implementation(libs.hilt.android)
  implementation(libs.hilt.navigation.compose)
  implementation(libs.room.runtime)
  implementation(libs.room.ktx)
  implementation(libs.retrofit)
  implementation(libs.retrofit.serialization)
  implementation(libs.okhttp)
  implementation(libs.okhttp.logging)
  implementation(libs.serialization.json)
  implementation(libs.work.runtime)
  implementation(libs.coil.compose)
  implementation(libs.coil.network.okhttp)
  implementation(libs.zxing.core)
  implementation(libs.androidx.biometric)
  implementation(libs.androidx.swipe.refresh.layout)
  ksp(libs.hilt.compiler)
  ksp(libs.room.compiler)

  testImplementation(libs.junit)
  androidTestImplementation(libs.androidx.junit)
  androidTestImplementation(libs.espresso.core)
  androidTestImplementation(platform(libs.compose.bom))
  androidTestImplementation(libs.compose.ui.test.junit4)
  debugImplementation(libs.compose.ui.tooling)
}


@Suppress("DEPRECATION")
android.applicationVariants.all {
  outputs.all {
    (this as BaseVariantOutputImpl).outputFileName = "乾坤戒-v$appVersionName-$name.apk"
  }
}


tasks.matching { it.name == "packageRelease" }.configureEach {
  doFirst {
    check(hasReleaseSigning) {
      "正式 APK 需要 QIANKUNJIE_RELEASE_STORE_FILE、QIANKUNJIE_RELEASE_STORE_PASSWORD、QIANKUNJIE_RELEASE_KEY_ALIAS、QIANKUNJIE_RELEASE_KEY_PASSWORD"
    }
  }
}
