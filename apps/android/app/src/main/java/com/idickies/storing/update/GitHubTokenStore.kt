package com.idickies.storing.update

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import dagger.hilt.android.qualifiers.ApplicationContext
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GitHubTokenStore @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  fun read(): String? = runCatching {
    val encoded = preferences.getString(TOKEN_VALUE, null) ?: return null
    GitHubTokenRules.normalize(decrypt(encoded))
  }.getOrElse {
    clear()
    null
  }

  fun save(token: String) {
    val normalized = requireNotNull(GitHubTokenRules.normalize(token)) { "GitHub 令牌格式无效" }
    preferences.edit().putString(TOKEN_VALUE, encrypt(normalized)).apply()
  }

  fun clear() {
    preferences.edit().remove(TOKEN_VALUE).apply()
  }

  private fun secretKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val entry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
    if (entry != null) return entry.secretKey

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return generator.generateKey()
  }

  private fun encrypt(plainText: String): String {
    val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, secretKey())
    val encrypted = cipher.doFinal(plainText.encodeToByteArray())
    val payload = ByteBuffer.allocate(1 + cipher.iv.size + encrypted.size)
      .put(cipher.iv.size.toByte())
      .put(cipher.iv)
      .put(encrypted)
      .array()
    return Base64.encodeToString(payload, Base64.NO_WRAP)
  }

  private fun decrypt(encoded: String): String {
    val payload = Base64.decode(encoded, Base64.NO_WRAP)
    require(payload.isNotEmpty()) { "GitHub 令牌密文为空" }
    val ivSize = payload[0].toInt() and 0xFF
    require(ivSize == GCM_IV_BYTES && payload.size > 1 + ivSize) { "GitHub 令牌密文格式无效" }
    val iv = payload.copyOfRange(1, 1 + ivSize)
    val encrypted = payload.copyOfRange(1 + ivSize, payload.size)
    val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
    return cipher.doFinal(encrypted).decodeToString()
  }

  private companion object {
    const val PREFERENCES_NAME = "qiankunjie_github_token"
    const val TOKEN_VALUE = "encrypted_token"
    const val KEY_ALIAS = "qiankunjie_github_token_v1"
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
    const val GCM_IV_BYTES = 12
    const val GCM_TAG_BITS = 128
  }
}
