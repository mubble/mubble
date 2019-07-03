package ui.biometric

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import core.BaseApp
import org.json.JSONObject

class BiometricHandler : BiometricCallback {

  private var cb: ((JSONObject) -> Unit)? = null

  fun canAuthWithFingerprint(): Boolean {

    val fingerprintManager = FingerprintManagerCompat.from(BaseApp.instance)

    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && fingerprintManager.isHardwareDetected
        && ContextCompat.checkSelfPermission(BaseApp.instance,
        Manifest.permission.USE_FINGERPRINT) == PackageManager.PERMISSION_GRANTED
  }

  fun showDialog(cb: ((JSONObject) -> Unit), title: String, subTitle: String,
                 desc: String, negBtnText: String, failureMsg: String, dialogViewRes: DialogViewRes) {

    this.cb = cb

    BiometricManager.BiometricBuilder(BaseApp.instance)
        .setTitle(title)
        .setSubtitle(subTitle)
        .setDescription(desc)
        .setNegativeButtonText(negBtnText)
        .build()
        .authenticate(this, failureMsg, dialogViewRes)
  }

  override fun onSdkVersionNotSupported() {
  }

  override fun onBiometricAuthenticationNotSupported() {
  }

  override fun onBiometricAuthenticationNotAvailable() {
  }

  override fun onBiometricAuthenticationPermissionNotGranted() {
  }

  override fun onBiometricAuthenticationInternalError(error: String) {
  }

  override fun onAuthenticationFailed() {
  }

  override fun onAuthenticationCancelled() {
  }

  override fun onAuthenticationSuccessful() {
  }

  override fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence) {
  }

  override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
  }

}