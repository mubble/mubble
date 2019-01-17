package ui.biometric

import android.support.v4.hardware.fingerprint.FingerprintManagerCompat
import android.support.v4.os.CancellationSignal
import core.MubbleLogger
import org.jetbrains.anko.info

class FingerprintHandler(private val cb: ((Boolean, String?) -> Unit)) : FingerprintManagerCompat.AuthenticationCallback(), MubbleLogger {

  fun startAuth(manager: FingerprintManagerCompat, cryptoObject: FingerprintManagerCompat.CryptoObject) {

    val cancellationSignal = CancellationSignal()
    manager.authenticate(cryptoObject, 0, cancellationSignal, this, null)
  }

  override fun onAuthenticationError(errMsgId: Int, errString: CharSequence?) {
    info { "Auth error" }
    cb(false, "Auth error")
  }

  override fun onAuthenticationHelp(helpMsgId: Int, helpString: CharSequence?) {
    info { "Auth help $helpString" }
    cb(false, "Auth help $helpString")
  }

  override fun onAuthenticationFailed() {
    info { "Auth failed" }
    cb(false, "Auth failed")
  }

  override fun onAuthenticationSucceeded(result: FingerprintManagerCompat.AuthenticationResult?) {
    info { "Auth success" }

    cb(true, null)
  }
}