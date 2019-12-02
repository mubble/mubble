package ui.biometric

import android.Manifest
import android.annotation.TargetApi
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import androidx.core.content.ContextCompat
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.info
import org.json.JSONObject
import xmn.EncProviderAndroid
import java.security.KeyFactory
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
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

    // TODO:
  }

  override fun onAuthenticationCancelled() {
  }

  @TargetApi(Build.VERSION_CODES.M)
  override fun onAuthenticationSuccessful(challenge: String, cipher: Cipher) {

    try {
      //We get the Keystore instance
      val keyStore: KeyStore = KeyStore.getInstance(BiometricManager.KEYSTORE).apply {
        load(null)
      }

      //Retrieves the private key from the keystore
      val privateKey: PrivateKey = keyStore.getKey(BiometricManager.KEY_NAME, null) as PrivateKey

      //We sign the data with the private key. We use RSA algorithm along SHA-256 digest algorithm
      val signature: ByteArray? = Signature.getInstance("SHA256withRSA").run {
        initSign(privateKey)
        update(challenge.toByteArray())
        sign()
      }

      if (signature != null) {
        //We encode and store in a variable the value of the signature

        val obj = JSONObject()
        obj.put("encData", Base64.encodeToString(signature, Base64.DEFAULT))
        cb(obj)
        return
      }

    } catch (e: UserNotAuthenticatedException) {
      //Exception thrown when the user has not been authenticated
    } catch (e: KeyPermanentlyInvalidatedException) {
      //Exception thrown when the key has been invalidated for example when lock screen has been disabled.
    } catch (e: Exception) {
      throw RuntimeException(e)
    }

    onAuthenticationFailed()

//    val sharedPrefs : SharedPreferences = BaseApp.instance.getSharedPreferences("enc-store", Context.MODE_PRIVATE)
//    val ssoContext= sharedPrefs.getString("sso-context", null)
//
//    if (ssoContext == null) {
//      onAuthenticationFailed()
//      return
//    }
//
//    val encKeyB64 = JSONObject(ssoContext).getString("context")
//    val encKey    = EncProviderAndroid.base64ToByteArray(encKeyB64)
//
//    val keyByteArr = cipher.doFinal(encKey)
//
//    info { "Test: Pub key from SharedPrefs ${EncProviderAndroid.byteArrayToBase64(keyByteArr)}" }
//
//    val encCipher   = Cipher.getInstance("RSA/NONE/OAEPPADDING")
//    val pubKeySpec  = X509EncodedKeySpec(keyByteArr)
//    val fact        = KeyFactory.getInstance("RSA")
//
//    encCipher.init(Cipher.ENCRYPT_MODE, fact.generatePublic(pubKeySpec))
//
//    val encByteArr = cipher.doFinal(challenge.toByteArray(Charsets.UTF_8))
//    val encStr     = EncProviderAndroid.byteArrayToBase64(encByteArr)
//
//    info { "Test: onAuthenticationSuccessful encText: $encStr" }
//
//    val obj = JSONObject()
//    obj.put("encText", encStr)
//    cb(obj)
  }

  override fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence) {
  }

  override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
  }

}