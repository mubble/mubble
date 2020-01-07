package ui.biometric

import android.annotation.TargetApi
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.google.api.client.util.Base64
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.info
import org.json.JSONObject
import ui.base.MubbleBaseActivity
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature

class MuBiometricPrompt(val activity : MubbleBaseActivity, val builder: BiometricBuilder) : MubbleLogger {

  private lateinit var biometricPrompt  : BiometricPrompt
  private lateinit var challenge        : String
  private lateinit var cb: ((JSONObject) -> Unit)

  init {
    if (canAuthenticate()) biometricPrompt = createBiometricPrompt()
  }

  companion object {

    private const val KEY_STORE = "AndroidKeyStore"
    private const val KEY_NAME  = "OBO_BIOMETRIC_KEY"
    private const val SIGN_ALGO = "SHA256withRSA"

    fun canAuthenticate(): Boolean {

      return androidx.biometric.BiometricManager.from(BaseApp.instance)
          .canAuthenticate() == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
    }

    @TargetApi(Build.VERSION_CODES.M)
    fun generateKeyPair(): String {

      val keyStore: KeyStore = KeyStore.getInstance(KEY_STORE)
      keyStore.load(null)
      keyStore.deleteEntry(KEY_NAME)

      val keyPairGenerator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEY_STORE)

      keyPairGenerator.initialize(
          KeyGenParameterSpec.Builder(KEY_NAME, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
              .setDigests(KeyProperties.DIGEST_SHA256)
              .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
              .setUserAuthenticationRequired(true)
              .build())

      val keyPair = keyPairGenerator.generateKeyPair()

      return "-----BEGIN PUBLIC KEY-----\n${Base64.encodeBase64String(keyPair.public.encoded)}\n-----END PUBLIC KEY-----"
    }

  }

  fun authenticate(challenge: String, cb: ((JSONObject) -> Unit)) {

    this.challenge = challenge
    this.cb        = cb

    val keyStore: KeyStore = KeyStore.getInstance(KEY_STORE)
    keyStore.load(null)

    val privateKey = keyStore.getKey(KEY_NAME, null) as PrivateKey

    val signature = Signature.getInstance(SIGN_ALGO)
    signature.initSign(privateKey)

    biometricPrompt.authenticate(createPromptInfo(), BiometricPrompt.CryptoObject(signature))
  }

  private fun signData(result: BiometricPrompt.AuthenticationResult) {

    // Sign data
    val sign = result.cryptoObject!!.signature!!
    sign.update(challenge.toByteArray())
    val signature = sign.sign()

    if (signature != null) {
      val obj = JSONObject()
      obj.put("encData", Base64.encodeBase64String(signature))
      cb(obj)
      return
    }

  }

  private fun createPromptInfo(): BiometricPrompt.PromptInfo {

    return BiometricPrompt.PromptInfo.Builder()
        .setTitle(builder.title.toString())
        .setSubtitle(builder.subtitle.toString())
        .setDescription(builder.description.toString())
        .setConfirmationRequired(false)
        .setNegativeButtonText(builder.negativeButtonText.toString())
        .build()
  }

  private fun createBiometricPrompt(): BiometricPrompt {

    val executor = ContextCompat.getMainExecutor(activity)

    val callback = object : BiometricPrompt.AuthenticationCallback() {

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        super.onAuthenticationError(errorCode, errString)

        info { "Error $errorCode :: $errString" }

        val obj = JSONObject()

        when (errorCode) {

          BiometricPrompt.ERROR_HW_UNAVAILABLE,
          BiometricPrompt.ERROR_HW_NOT_PRESENT -> {
            obj.put("errorCode", "NOT_SUPPORTED")
          }

          BiometricPrompt.ERROR_NO_SPACE,
          BiometricPrompt.ERROR_CANCELED,
          BiometricPrompt.ERROR_LOCKOUT_PERMANENT,
          BiometricPrompt.ERROR_NO_BIOMETRICS,
          BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> {
            obj.put("errorCode", "KEY_INVALIDATED")
          }

          BiometricPrompt.ERROR_UNABLE_TO_PROCESS,
          BiometricPrompt.ERROR_TIMEOUT,
          BiometricPrompt.ERROR_LOCKOUT,
          BiometricPrompt.ERROR_VENDOR -> {
            obj.put("errorCode", "TIMED_OUT")
          }

          BiometricPrompt.ERROR_NEGATIVE_BUTTON,
          BiometricPrompt.ERROR_USER_CANCELED -> {
            obj.put("errorCode", "USER_CANCELLED")
          }

        }
        cb(obj)
      }

      override fun onAuthenticationFailed() {
        super.onAuthenticationFailed()

        val obj = JSONObject()
        obj.put("errorCode", "AUTH_FAILED")
        cb(obj)
      }

      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        super.onAuthenticationSucceeded(result)

        info { "Signing Data for Fingerprint $challenge" }
        signData(result)
      }
    }

    return BiometricPrompt(activity, executor, callback)
  }

  class BiometricBuilder(val activity: MubbleBaseActivity) {

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

    fun build(): BiometricBuilder {
      return this
    }
  }

}