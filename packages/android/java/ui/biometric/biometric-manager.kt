package ui.biometric

import android.content.Context
import android.content.DialogInterface
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.annotation.TargetApi
import android.content.SharedPreferences
import android.os.CancellationSignal
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import core.BaseApp
import org.jetbrains.anko.info
import org.json.JSONObject
import xmn.EncProviderAndroid
import java.io.IOException
import java.lang.IllegalStateException
import java.security.*
import java.security.cert.CertificateException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.NoSuchPaddingException
import javax.crypto.SecretKey
import com.facebook.internal.FacebookRequestErrorClassification.KEY_NAME
import java.security.spec.ECGenParameterSpec
import java.security.spec.RSAKeyGenParameterSpec


open class BiometricManager constructor() : BiometricManagerV23() {

  companion object {
    const val KEY_NAME = "OBO_BIOMETRIC_KEY"
    const val KEYSTORE = "AndroidKeyStore"
  }

  protected constructor(biometricBuilder : BiometricBuilder) : this() {

    this.context            = biometricBuilder.context
    this.title              = biometricBuilder.title
    this.subtitle           = biometricBuilder.subtitle
    this.description        = biometricBuilder.description
    this.negativeButtonText = biometricBuilder.negativeButtonText
  }

  fun enroll(publicKey : String) {

    generateKey(publicKey)
  }

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

    val cipher = initCipher() ?: throw IllegalStateException("Could not init Cipher")

    displayBiometricDialog(challenge, cipher, biometricCallback, failMsg, dialogViewRes)
  }

  private fun displayBiometricDialog(challenge: String, cipher: Cipher, biometricCallback: BiometricCallback,
                                     failMsg: String, dialogViewRes: DialogViewRes) {

    if (BiometricUtils.isBiometricPromptEnabled()) {
      val cryptoObject = BiometricPrompt.CryptoObject(cipher)
      displayBiometricPrompt(challenge, cryptoObject, biometricCallback)

    } else {
      val cryptoObject = FingerprintManagerCompat.CryptoObject(cipher)
      displayBiometricPromptV23(challenge, cryptoObject, biometricCallback, failMsg, dialogViewRes)
    }
  }

  @TargetApi(Build.VERSION_CODES.P)
  private fun displayBiometricPrompt(challenge: String, cryptoObject: BiometricPrompt.CryptoObject, biometricCallback: BiometricCallback) {

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
  private fun generateKey(pubKey: String) {

    info { "Test: Pub key for init $pubKey" }

    try {

      val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,
          "AndroidKeyStore")
      keyGenerator.init(KeyGenParameterSpec.Builder(KEY_NAME,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
          .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
          .setUserAuthenticationRequired(true)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
          .build())
      val key = keyGenerator.generateKey()

      val cipher = Cipher.getInstance(
          KeyProperties.KEY_ALGORITHM_AES + "/"
              + KeyProperties.BLOCK_MODE_CBC + "/"
              + KeyProperties.ENCRYPTION_PADDING_PKCS7)

      cipher.init(Cipher.ENCRYPT_MODE, key)

      val encBytes = cipher.doFinal(pubKey.toByteArray(Charsets.UTF_8))
      val encStr   = EncProviderAndroid.byteArrayToBase64(encBytes)

      val sharedPrefs : SharedPreferences = BaseApp.instance.getSharedPreferences("enc-store", Context.MODE_PRIVATE)
      val editor      : SharedPreferences.Editor  = sharedPrefs.edit()

      val obj = JSONObject()
      obj.put("context", encStr)
      obj.put("ts", System.currentTimeMillis())

      editor.putString("sso-context", obj.toString())
      editor.apply()

      info { "Test: SSO context saved : $obj" }

//      val keyStore = KeyStore.getInstance(KEYSTORE)
//      keyStore!!.load(null)
//
//      val secKeySpec = SecretKeySpec(Base64.decode(pubKey, Base64.DEFAULT) , KeyProperties.KEY_ALGORITHM_AES)
//
//      keyStore.setEntry(KEY_NAME, KeyStore.SecretKeyEntry(secKeySpec),
//          KeyProtection.Builder(KeyProperties.PURPOSE_ENCRYPT)
//              .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
//              .setUserAuthenticationRequired(true)
//              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
//              .build())

    } catch (exc: KeyStoreException) {
      exc.printStackTrace()
    } catch (exc: NoSuchAlgorithmException) {
      exc.printStackTrace()
    } catch (exc: NoSuchProviderException) {
      exc.printStackTrace()
    } catch (exc: InvalidAlgorithmParameterException) {
      exc.printStackTrace()
    } catch (exc: CertificateException) {
      exc.printStackTrace()
    } catch (exc: IOException) {
      exc.printStackTrace()
    }

  }

  @TargetApi(Build.VERSION_CODES.M)
  private fun initCipher(): Cipher? {

    try {

      val cipher = Cipher.getInstance(
          KeyProperties.KEY_ALGORITHM_AES + "/"
          + KeyProperties.BLOCK_MODE_CBC + "/"
          + KeyProperties.ENCRYPTION_PADDING_PKCS7)

      val keyStore = KeyStore.getInstance(KEYSTORE)
      keyStore.load(null)

      val key = keyStore.getKey(KEY_NAME, null) as SecretKey
      cipher.init(Cipher.DECRYPT_MODE, key)
      return cipher

    } catch (e: KeyPermanentlyInvalidatedException) {
      return null

    } catch (e: KeyStoreException) {

      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: CertificateException) {
      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: UnrecoverableKeyException) {
      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: IOException) {
      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: NoSuchAlgorithmException) {
      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: InvalidKeyException) {
      throw RuntimeException("Failed to init Cipher", e)
    } catch (e: NoSuchPaddingException) {
      throw RuntimeException("Failed to get Cipher", e)
    }
  }

  @TargetApi(Build.VERSION_CODES.M)
  fun generateKeyPair(): String {

    val keyPairGenerator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore")

    keyPairGenerator.initialize(
        KeyGenParameterSpec.Builder(KEY_NAME,
            KeyProperties.PURPOSE_DECRYPT and KeyProperties.PURPOSE_ENCRYPT)
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
            .setUserAuthenticationRequired(true)
            .build())

    val keyPair = keyPairGenerator.generateKeyPair()

    return Base64.encode(keyPair.public.encoded, Base64.DEFAULT).toString()
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