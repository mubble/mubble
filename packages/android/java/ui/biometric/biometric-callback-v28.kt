package ui.biometric

import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import androidx.annotation.RequiresApi
import core.MubbleLogger
import org.jetbrains.anko.info
import xmn.EncProviderAndroid

@RequiresApi(api = Build.VERSION_CODES.P)
class BiometricCallbackV28(private val challenge: String,
                           private val biometricCallback: BiometricCallback):

    BiometricPrompt.AuthenticationCallback(), MubbleLogger {

  override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) {
    super.onAuthenticationSucceeded(result)
    biometricCallback.onAuthenticationSuccessful(challenge, result!!.cryptoObject)
  }

  override fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence) {
    super.onAuthenticationHelp(helpCode, helpString)
    biometricCallback.onAuthenticationHelp(helpCode, helpString)
  }

  override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
    super.onAuthenticationError(errorCode, errString)
    biometricCallback.onAuthenticationError(errorCode, errString)
  }

  override fun onAuthenticationFailed() {
    super.onAuthenticationFailed()
    biometricCallback.onAuthenticationFailed(false)
  }
}