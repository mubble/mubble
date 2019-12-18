package ui.biometric

import android.Manifest
import android.annotation.TargetApi
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.UserNotAuthenticatedException
import androidx.core.content.ContextCompat
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import com.google.api.client.util.Base64
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.error
import org.jetbrains.anko.warn
import org.json.JSONObject
import java.security.Signature

class BiometricHandler : MubbleLogger, BiometricCallback {

  private lateinit var cb: ((JSONObject) -> Unit)

  fun canAuthWithFingerprint(): Boolean {

    val fingerprintManager = FingerprintManagerCompat.from(BaseApp.instance)

    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && fingerprintManager.isHardwareDetected
        && ContextCompat.checkSelfPermission(BaseApp.instance,
        Manifest.permission.USE_FINGERPRINT) == PackageManager.PERMISSION_GRANTED
  }

  fun generateFpKeyPair(): String {

    val mgr = BiometricManager()
    return mgr.generateKeyPair()
  }

  fun showDialog(challenge: String, cb: ((JSONObject) -> Unit), title: String, subTitle: String,
                 desc: String, negBtnText: String, failureMsg: String, dialogViewRes: DialogViewRes) {

    this.cb = cb

    BiometricManager.BiometricBuilder(BaseApp.instance)
        .setTitle(title)
        .setSubtitle(subTitle)
        .setDescription(desc)
        .setNegativeButtonText(negBtnText)
        .build()
        .authenticate(challenge,this, failureMsg, dialogViewRes)
  }

  override fun onSdkVersionNotSupported() {

    val obj = JSONObject()
    obj.put("errorCode", "NOT_SUPPORTED")
    cb(obj)
  }

  override fun onBiometricAuthenticationNotSupported() {

    val obj = JSONObject()
    obj.put("errorCode", "NOT_SUPPORTED")
    cb(obj)
  }

  override fun onBiometricAuthenticationNotAvailable() {

    val obj = JSONObject()
    obj.put("errorCode", "AUTH_NOT_AVAILABLE")
    cb(obj)
  }

  override fun onBiometricAuthenticationPermissionNotGranted() {

    val obj = JSONObject()
    obj.put("errorCode", "PERMISSION_DENIED")
    cb(obj)
  }

  override fun onBiometricAuthenticationInternalError(error: String) {

    val obj = JSONObject()
    obj.put("errorCode", "KEY_EXPIRED")
    cb(obj)
  }

  override fun onAuthenticationFailed(reset: Boolean) {

    val obj = JSONObject()
    obj.put("errorCode", "KEY_EXPIRED")
    cb(obj)
  }

  override fun onAuthenticationCancelled() {

    val obj = JSONObject()
    obj.put("errorCode", "USER_CANCELLED")
    cb(obj)
  }

  @TargetApi(Build.VERSION_CODES.P)
  override fun onAuthenticationSuccessful(challenge: String, cryptoObject : BiometricPrompt.CryptoObject) {

    try {

      signData(challenge, cryptoObject.signature)

    } catch (e: UserNotAuthenticatedException) {
      //Exception thrown when the user has not been authenticated
      onAuthenticationFailed(true)

    } catch (e: KeyPermanentlyInvalidatedException) {
      //Exception thrown when the key has been invalidated for example when lock screen has been disabled.
      onAuthenticationFailed(true)

    } catch (e: Exception) {
      error { e.printStackTrace() }
      onAuthenticationFailed(true)
    }

  }

  @TargetApi(Build.VERSION_CODES.M)
  override fun onAuthenticationSuccessful(challenge: String, cryptoObject: FingerprintManagerCompat.CryptoObject) {

    try {

      signData(challenge, cryptoObject.signature!!)

    } catch (e: UserNotAuthenticatedException) {
      //Exception thrown when the user has not been authenticated
      onAuthenticationFailed(true)

    } catch (e: KeyPermanentlyInvalidatedException) {
      //Exception thrown when the key has been invalidated for example when lock screen has been disabled.
      onAuthenticationFailed(true)

    } catch (e: Exception) {
      onAuthenticationFailed(true)
      error { e.printStackTrace() }
    }

  }

  override fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence) {

    val obj = JSONObject()
    obj.put("errorCode", "HELP")
    cb(obj)
  }

  override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {

    warn { "Error happened in Fingerprint $errorCode $errString" }
    onAuthenticationFailed(true)
  }

  private fun signData(challenge: String, sign: Signature) {

    val signature: ByteArray? = sign.run {
      update(challenge.toByteArray())
      sign()
    }

    if (signature != null) {
      //We encode and store in a variable the value of the signature

      val obj = JSONObject()
      obj.put("encData", Base64.encodeBase64String(signature))
      cb(obj)
      return
    }

  }

}