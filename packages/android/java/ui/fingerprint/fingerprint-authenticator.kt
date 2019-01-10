package ui.fingerprint

import android.Manifest
import android.annotation.TargetApi
import android.app.KeyguardManager
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.KeyProperties.*
import android.support.annotation.RequiresApi
import android.support.v4.content.ContextCompat
import android.support.v4.hardware.fingerprint.FingerprintManagerCompat
import core.BaseApp
import core.MubbleLogger
import java.io.IOException
import java.security.*
import java.security.cert.CertificateException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.NoSuchPaddingException
import javax.crypto.SecretKey

class FingerPrintAuthenticator: MubbleLogger {

  private lateinit var keyStore      : KeyStore
  private lateinit var keyGenerator  : KeyGenerator
  private lateinit var cipher        : Cipher

  @RequiresApi(Build.VERSION_CODES.M)
  private val keyguardManager     = BaseApp.instance.getSystemService(KeyguardManager::class.java)
  private val fingerprintManager  = FingerprintManagerCompat.from(BaseApp.instance)

  companion object {
    private const val ANDROID_KEY_STORE   = "AndroidKeyStore"
    private const val ANDROID_KEY         = "AndroidKey"
  }

  fun isBiometricPromptEnabled(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
  }

  fun canRequestAuth(): String? {

    /*
     * Check if the android version in device is greater than
     * Marshmallow, since fingerprint authentication is only supported
     * from Android 6.0.
     * Note: If your project's minSdkversion is 23 or higher,
     * then you won't need to perform this check.
     *
     * */
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return "Build version less than Marshmallow"
    }

    /*
     * Check if the device has fingerprint sensors.
     * Note: If you marked android.hardware.fingerprint as something that
     * your app requires (android:required="true"), then you don't need
     * to perform this check.
     *
     * */
    if (!fingerprintManager.isHardwareDetected) {
      return "Fingerprint sensor not present on device"
    }

    /*
     * Check if the permission has been added to
     * the app. This permission will be granted as soon as the user
     * installs the app on their device.
     *
     * */
    // Permission should be moved to initialize
    if (ContextCompat.checkSelfPermission(BaseApp.instance,
            Manifest.permission.USE_FINGERPRINT) != PackageManager.PERMISSION_GRANTED) {
      return "Fingerprint permission missing"
    }

    if (!keyguardManager.isKeyguardSecure) {
      return "You have not set up a lock screen security"
    }

    /*
    * Fingerprint authentication can be matched with a
    * registered fingerprint of the user. So we need to perform this check
    * in order to enable fingerprint authentication
    *
    * */
    if (!fingerprintManager.hasEnrolledFingerprints()) {
      return "No fingerprints are registered"
    }

    return null
  }

  fun initialize(cb: ((Boolean, String?) -> Unit)) {

    setupKeyStoreAndKeyGenerator()
    generateKey()

    if (setupCipher()) {
      val cryptoObject        = FingerprintManagerCompat.CryptoObject(cipher)
      val fingerprintHandler  = FingerprintHandler(cb)
      fingerprintHandler.startAuth(fingerprintManager, cryptoObject)
    }
  }

  /**
   * Setting up KeyStore and KeyGenerator
   */
  @TargetApi(Build.VERSION_CODES.M)
  private fun setupKeyStoreAndKeyGenerator() {

    try {
      keyStore = KeyStore.getInstance(ANDROID_KEY_STORE)
    } catch (e: KeyStoreException) {
      throw RuntimeException("Failed to get an instance of KeyStore", e)
    }

    try {
      keyGenerator = KeyGenerator.getInstance(KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
    } catch (e: Exception) {
      when (e) {
        is NoSuchAlgorithmException,
        is NoSuchProviderException ->
          throw RuntimeException("Failed to get an instance of KeyGenerator", e)
        else -> throw e
      }
    }
  }

  /**
   * Sets up default cipher
   */
  @TargetApi(Build.VERSION_CODES.M)
  private fun setupCipher(): Boolean {

    try {
      val cipherString  = "$KEY_ALGORITHM_AES/$BLOCK_MODE_CBC/$ENCRYPTION_PADDING_PKCS7"
      cipher            = Cipher.getInstance(cipherString)

      keyStore.load(null)
      val key : SecretKey = keyStore.getKey(ANDROID_KEY, null) as SecretKey
      cipher.init(Cipher.ENCRYPT_MODE, key)

    } catch (e: Exception) {

      when (e) {
        is KeyPermanentlyInvalidatedException -> return false
        is KeyStoreException,
        is CertificateException,
        is UnrecoverableKeyException,
        is IOException,
        is NoSuchAlgorithmException,
        is NoSuchPaddingException ->
          throw RuntimeException("Failed to get an instance of Cipher", e)
        else -> throw e
      }
    }

    return true
  }

  @TargetApi(Build.VERSION_CODES.M)
  private fun generateKey() {

    try {

      keyStore.load(null)
      keyGenerator.init(KeyGenParameterSpec.Builder(ANDROID_KEY,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
          .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
          .setUserAuthenticationRequired(true)
          .setEncryptionPaddings(
              KeyProperties.ENCRYPTION_PADDING_PKCS7)
          .build())
      keyGenerator.generateKey()

    } catch (e: KeyStoreException) {
      e.printStackTrace()
    } catch (e: IOException) {
      e.printStackTrace()
    } catch (e: CertificateException) {
      e.printStackTrace()
    } catch (e: NoSuchAlgorithmException) {
      e.printStackTrace()
    } catch (e: InvalidAlgorithmParameterException) {
      e.printStackTrace()
    } catch (e: NoSuchProviderException) {
      e.printStackTrace()
    }

  }
}