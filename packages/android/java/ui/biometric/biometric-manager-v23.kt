package ui.biometric

import android.annotation.TargetApi
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.core.hardware.fingerprint.FingerprintManagerCompat
import androidx.core.os.CancellationSignal
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.info
import org.json.JSONObject
import xmn.EncProviderAndroid
import java.lang.IllegalStateException
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher

@TargetApi(Build.VERSION_CODES.M)
open class BiometricManagerV23 : MubbleLogger {

  //private var cipher        : Cipher?                                 = null
  //private var keyStore      : KeyStore?                               = null
  //private var keyGenerator  : KeyGenerator?                           = null
  //private var cryptoObject  : FingerprintManagerCompat.CryptoObject?  = null

  protected var context             : Context?            = null
  protected var title               : String?             = null
  protected var subtitle            : String?             = null
  protected var description         : String?             = null
  protected var negativeButtonText  : String?             = null
  private   var biometricDialogV23  : BiometricDialogV23? = null

  private lateinit var challenge: String

//
//  companion object {
//
//    private val KEY_NAME = UUID.randomUUID().toString()
//  }

  fun displayBiometricPromptV23(challenge: String, cryptoObject: FingerprintManagerCompat.CryptoObject,
                                biometricCallback: BiometricCallback, biometricFailMsg: String,
                                dialogViewRes: DialogViewRes) {

    this.challenge = challenge

    //generateKey()

    //if (initCipher()) {

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
              biometricCallback.onAuthenticationSuccessful(challenge, result!!.cryptoObject!!.cipher!!)
            }

            override fun onAuthenticationFailed() {
              super.onAuthenticationFailed()
              updateStatus(biometricFailMsg)
              biometricCallback.onAuthenticationFailed()
            }
          }, null)

      displayBiometricDialog(biometricCallback, dialogViewRes)
    //}
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

//  private fun generateKey() {
//
//    try {
//      keyStore = KeyStore.getInstance("AndroidKeyStore")
//      keyStore!!.load(null)
//
//      val inputStream = ByteArrayInputStream("dndjcn".toByteArray(Charsets.UTF_8))
//      val cert        = CertificateFactory.getInstance("X.509").generateCertificate(inputStream)
//
//      keyStore!!.setEntry(KEY_NAME, KeyStore.TrustedCertificateEntry(cert),
//          KeyProtection.Builder(KeyProperties.PURPOSE_ENCRYPT)
//              .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
//              .setUserAuthenticationRequired(true)
//              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
//              .build())
////
////      keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
////      keyGenerator!!.init(KeyGenParameterSpec.Builder(KEY_NAME, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
////          .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
////          .setUserAuthenticationRequired(true)
////          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
////          .build())
////
////      keyGenerator!!.generateKey()
//
//    } catch (exc: KeyStoreException) {
//      exc.printStackTrace()
//    } catch (exc: NoSuchAlgorithmException) {
//      exc.printStackTrace()
//    } catch (exc: NoSuchProviderException) {
//      exc.printStackTrace()
//    } catch (exc: InvalidAlgorithmParameterException) {
//      exc.printStackTrace()
//    } catch (exc: CertificateException) {
//      exc.printStackTrace()
//    } catch (exc: IOException) {
//      exc.printStackTrace()
//    }
//
//  }

//
//  private fun initCipher(): Boolean {
//
//    try {
//      cipher = Cipher.getInstance(
//          KeyProperties.KEY_ALGORITHM_AES + "/"
//              + KeyProperties.BLOCK_MODE_CBC + "/"
//              + KeyProperties.ENCRYPTION_PADDING_PKCS7)
//
//    } catch (e: NoSuchAlgorithmException) {
//      throw RuntimeException("Failed to get Cipher", e)
//    } catch (e: NoSuchPaddingException) {
//      throw RuntimeException("Failed to get Cipher", e)
//    }
//
//    try {
//      keyStore!!.load(null)
//
//      //val key = keyStore!!.getKey(KEY_NAME, null) as SecretKey
//
//      val cert = keyStore!!.getCertificate(KEY_NAME)
//
//      cipher!!.init(Cipher.ENCRYPT_MODE, cert)
//      return true
//
//    } catch (e: KeyPermanentlyInvalidatedException) {
//      return false
//
//    } catch (e: KeyStoreException) {
//
//      throw RuntimeException("Failed to init Cipher", e)
//    } catch (e: CertificateException) {
//      throw RuntimeException("Failed to init Cipher", e)
//    } catch (e: UnrecoverableKeyException) {
//      throw RuntimeException("Failed to init Cipher", e)
//    } catch (e: IOException) {
//      throw RuntimeException("Failed to init Cipher", e)
//    } catch (e: NoSuchAlgorithmException) {
//      throw RuntimeException("Failed to init Cipher", e)
//    } catch (e: InvalidKeyException) {
//      throw RuntimeException("Failed to init Cipher", e)
//    }
//
//  }

}