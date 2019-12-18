package ui.biometric

import android.annotation.TargetApi
import android.content.Context
import android.content.DialogInterface
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import com.google.api.client.util.Base64
import java.security.*

open class BiometricManager constructor() : BiometricManagerV23() {

  companion object {
    const val KEY_NAME = "OBO_FP_KEY"
    const val KEYSTORE = "AndroidKeyStore"
  }

  protected constructor(biometricBuilder : BiometricBuilder) : this() {

    this.context            = biometricBuilder.context
    this.title              = biometricBuilder.title
    this.subtitle           = biometricBuilder.subtitle
    this.description        = biometricBuilder.description
    this.negativeButtonText = biometricBuilder.negativeButtonText
  }

  @TargetApi(Build.VERSION_CODES.M)
  fun authenticate(challenge: String, biometricCallback: BiometricCallback, failMsg: String, dialogViewRes: DialogViewRes) {

    if (title == null) {
      biometricCallback.onBiometricAuthenticationInternalError("Biometric Dialog title cannot be null")
    }

    if (subtitle == null) {
      biometricCallback.onBiometricAuthenticationInternalError("Biometric Dialog subtitle cannot be null")
    }

    if (description == null) {
      biometricCallback.onBiometricAuthenticationInternalError("Biometric Dialog description cannot be null")
    }

    if (negativeButtonText == null) {
      biometricCallback.onBiometricAuthenticationInternalError("Biometric Dialog negative button text cannot be null")
    }

    if (!BiometricUtils.isSdkVersionSupported()) {
      biometricCallback.onSdkVersionNotSupported()
    }

    if (!BiometricUtils.isPermissionGranted(context!!)) {
      biometricCallback.onBiometricAuthenticationPermissionNotGranted()
    }

    if (!BiometricUtils.isHardwareSupported(context!!)) {
      biometricCallback.onBiometricAuthenticationNotSupported()
    }

    if (!BiometricUtils.isFingerprintAvailable(context!!)) {
      biometricCallback.onBiometricAuthenticationNotAvailable()
    }

    val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE).apply {
      load(null)
    }

    val entry = keyStore.getKey(KEY_NAME, null) as PrivateKey

    val signature = Signature.getInstance("SHA256withRSA")
    signature.initSign(entry)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && BiometricUtils.isBiometricPromptEnabled()) {
      val obj = BiometricPrompt.CryptoObject(signature)
      displayBiometricPrompt(challenge, obj, biometricCallback)
    } else {
      val obj = FingerprintManagerCompat.CryptoObject(signature)
      displayBiometricDialog(challenge, obj, biometricCallback, failMsg, dialogViewRes)
    }
  }

  private fun displayBiometricDialog(challenge: String, cryptoObj: FingerprintManagerCompat.CryptoObject,
                                     biometricCallback: BiometricCallback,
                                     failMsg: String, dialogViewRes: DialogViewRes) {

    displayBiometricPromptV23(challenge, cryptoObj, biometricCallback, failMsg, dialogViewRes)
  }

  @TargetApi(Build.VERSION_CODES.P)
  private fun displayBiometricPrompt(challenge: String, cryptoObject: BiometricPrompt.CryptoObject,
                                     biometricCallback: BiometricCallback) {

    BiometricPrompt.Builder(context)
        .setTitle(title!!)
        .setSubtitle(subtitle!!)
        .setDescription(description!!)
        .setNegativeButton(negativeButtonText!!, context!!.mainExecutor,
            DialogInterface.OnClickListener { _, _ -> biometricCallback.onAuthenticationCancelled() })
        .build()
        .authenticate(cryptoObject, CancellationSignal(), context!!.mainExecutor,
            BiometricCallbackV28(challenge, biometricCallback))
  }

  @TargetApi(Build.VERSION_CODES.M)
  fun generateKeyPair(): String {

    val keyPairGenerator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE)

    keyPairGenerator.initialize(
        KeyGenParameterSpec.Builder(KEY_NAME,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
            .setUserAuthenticationRequired(true)
            .build())

    val keyPair = keyPairGenerator.generateKeyPair()

    return "-----BEGIN PUBLIC KEY-----\n${Base64.encodeBase64String(keyPair.public.encoded)}\n-----END PUBLIC KEY-----"
  }

  class BiometricBuilder(val context: Context) {

    var title: String? = null
    var subtitle: String? = null
    var description: String? = null
    var negativeButtonText: String? = null

    fun setTitle(title: String): BiometricBuilder {
      this.title = title
      return this
    }

    fun setSubtitle(subtitle: String): BiometricBuilder {
      this.subtitle = subtitle
      return this
    }

    fun setDescription(description: String): BiometricBuilder {
      this.description = description
      return this
    }


    fun setNegativeButtonText(negativeButtonText: String): BiometricBuilder {
      this.negativeButtonText = negativeButtonText
      return this
    }

    fun build(): BiometricManager {
      return BiometricManager(this)
    }
  }
}