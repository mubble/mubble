package ui.biometric

import android.annotation.TargetApi
import android.content.Context
import android.os.Build
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import androidx.core.os.CancellationSignal
import core.MubbleLogger

@TargetApi(Build.VERSION_CODES.M)
open class BiometricManagerV23 : MubbleLogger {

  protected var context             : Context?            = null
  protected var title               : String?             = null
  protected var subtitle            : String?             = null
  protected var description         : String?             = null
  protected var negativeButtonText  : String?             = null
  private   var biometricDialogV23  : BiometricDialogV23? = null

  private lateinit var challenge: String

  fun displayBiometricPromptV23(challenge: String, cryptoObject: FingerprintManagerCompat.CryptoObject,
                                biometricCallback: BiometricCallback, biometricFailMsg: String,
                                dialogViewRes: DialogViewRes) {

    this.challenge = challenge

    val fingerprintManagerCompat  = FingerprintManagerCompat.from(context!!)

    fingerprintManagerCompat.authenticate(cryptoObject, 0, CancellationSignal(),
        object : FingerprintManagerCompat.AuthenticationCallback() {

          override fun onAuthenticationError(errMsgId: Int, errString: CharSequence?) {
            super.onAuthenticationError(errMsgId, errString)
            updateStatus(errString.toString())
            biometricCallback.onAuthenticationError(errMsgId, errString!!)
          }

          override fun onAuthenticationHelp(helpMsgId: Int, helpString: CharSequence?) {
            super.onAuthenticationHelp(helpMsgId, helpString)
            updateStatus(helpString.toString())
            biometricCallback.onAuthenticationHelp(helpMsgId, helpString!!)
          }

          override fun onAuthenticationSucceeded(result: FingerprintManagerCompat.AuthenticationResult?) {
            super.onAuthenticationSucceeded(result)
            dismissDialog()
            biometricCallback.onAuthenticationSuccessful(challenge, result!!.cryptoObject!!)
          }

          override fun onAuthenticationFailed() {
            super.onAuthenticationFailed()
            updateStatus(biometricFailMsg)
            biometricCallback.onAuthenticationFailed(true)
          }
        }, null)

    displayBiometricDialog(biometricCallback, dialogViewRes)
  }

  private fun displayBiometricDialog(biometricCallback: BiometricCallback, dialogViewRes: DialogViewRes) {

    biometricDialogV23 = BiometricDialogV23(biometricCallback, dialogViewRes)
    biometricDialogV23!!.setTitle(title)
    biometricDialogV23!!.setSubtitle(subtitle!!)
    biometricDialogV23!!.setDescription(description!!)
    biometricDialogV23!!.setButtonText(negativeButtonText!!)
    biometricDialogV23!!.show()
  }

  private fun dismissDialog() {
    if (biometricDialogV23 != null) {
      biometricDialogV23!!.dismiss()
    }
  }

  private fun updateStatus(status: String) {
    if (biometricDialogV23 != null) {
      biometricDialogV23!!.updateStatus(status)
    }
  }

}