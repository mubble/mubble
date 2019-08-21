package ui.biometric

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.info
import org.json.JSONObject
import xmn.EncProviderAndroid
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher

class BiometricHandler : MubbleLogger, BiometricCallback {

  private lateinit var cb: ((JSONObject) -> Unit)

  fun canAuthWithFingerprint(): Boolean {

    val fingerprintManager = FingerprintManagerCompat.from(BaseApp.instance)

    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && fingerprintManager.isHardwareDetected
        && ContextCompat.checkSelfPermission(BaseApp.instance,
        Manifest.permission.USE_FINGERPRINT) == PackageManager.PERMISSION_GRANTED
  }

  fun enrollKey(pubKey: String) {

    val mgr = BiometricManager()
    mgr.enroll(pubKey)
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

  override fun onAuthenticationSuccessful(challenge: String, cipher: Cipher) {

    val sharedPrefs : SharedPreferences = BaseApp.instance.getSharedPreferences("enc-store", Context.MODE_PRIVATE)
    val ssoContext= sharedPrefs.getString("sso-context", null)

    if (ssoContext == null) {
      onAuthenticationFailed() // TODO:
      return
    }

    val encKeyB64 = JSONObject(ssoContext).getString("context")
    val encKey    = EncProviderAndroid.base64ToByteArray(encKeyB64)

    val keyByteArr = cipher.doFinal(encKey)

    info { "Test: Pub key from SharedPrefs ${EncProviderAndroid.byteArrayToBase64(keyByteArr)}" }

    val encCipher   = Cipher.getInstance("RSA/NONE/OAEPPADDING")
    val pubKeySpec  = X509EncodedKeySpec(keyByteArr)
    val fact        = KeyFactory.getInstance("RSA")

    encCipher.init(Cipher.ENCRYPT_MODE, fact.generatePublic(pubKeySpec))

    val encByteArr = cipher.doFinal(challenge.toByteArray(Charsets.UTF_8))
    val encStr     = EncProviderAndroid.byteArrayToBase64(encByteArr)

    info { "Test: onAuthenticationSuccessful encText: $encStr" }

    val obj = JSONObject()
    obj.put("encText", encStr)
    cb(obj)
  }

  override fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence) {
  }

  override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
  }

}