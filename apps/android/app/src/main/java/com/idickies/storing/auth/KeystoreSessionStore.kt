package com.idickies.storing.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val PREFS_NAME = "qiankunjie_secure_session"
private const val SESSION_VALUE = "encrypted_session"
private const val KEY_ALIAS = "qiankunjie_session_v1"
private const val GCM_IV_BYTES = 12
private const val GCM_TAG_BITS = 128

class KeystoreSessionStore(context: Context) : SessionStore {
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  override fun read(): SessionTokens? = runCatching {
    val encoded = prefs.getString(SESSION_VALUE, null) ?: return null
    decode(decrypt(encoded))
  }.getOrElse {
    clear()
    null
  }

  override fun write(tokens: SessionTokens) {
    prefs.edit().putString(SESSION_VALUE, encrypt(encode(tokens))).apply()
  }

  override fun clear() {
    prefs.edit().remove(SESSION_VALUE).apply()
  }

  private fun secretKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val entry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
    if (entry != null) return entry.secretKey

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
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
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
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
    require(payload.isNotEmpty()) { "空的会话密文" }
    val ivSize = payload[0].toInt() and 0xFF
    require(ivSize == GCM_IV_BYTES && payload.size > 1 + ivSize) { "会话密文格式无效" }
    val iv = payload.copyOfRange(1, 1 + ivSize)
    val encrypted = payload.copyOfRange(1 + ivSize, payload.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
    return cipher.doFinal(encrypted).decodeToString()
  }

  private fun encode(tokens: SessionTokens): String = listOf(
    tokens.accessToken,
    tokens.accessTokenExpiresAtEpochMs.toString(),
    tokens.refreshToken,
    tokens.refreshTokenExpiresAtEpochMs.toString(),
  ).joinToString("\n")

  private fun decode(value: String): SessionTokens {
    val fields = value.split("\n")
    require(fields.size == 4) { "会话字段无效" }
    return SessionTokens(
      accessToken = fields[0],
      accessTokenExpiresAtEpochMs = fields[1].toLong(),
      refreshToken = fields[2],
      refreshTokenExpiresAtEpochMs = fields[3].toLong(),
    )
  }
}
