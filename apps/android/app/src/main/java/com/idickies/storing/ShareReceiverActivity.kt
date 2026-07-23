package com.idickies.storing

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

class ShareReceiverActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val sharedText = intent?.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty()
    startActivity(
      Intent(this, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(MainActivity.EXTRA_SHARED_TEXT, sharedText),
    )
    finish()
  }
}
