package ui.biometric

import android.hardware.biometrics.BiometricPrompt
import androidx.core.hardware.fingerprint.FingerprintManagerCompat

interface BiometricCallback {

  fun onSdkVersionNotSupported()

  fun onBiometricAuthenticationNotSupported()

  fun onBiometricAuthenticationNotAvailable()

  fun onBiometricAuthenticationPermissionNotGranted()

  fun onBiometricAuthenticationInternalError(error: String)


  fun onAuthenticationFailed(reset: Boolean)

  fun onAuthenticationCancelled()

  fun onAuthenticationSuccessful(challenge: String, cryptoObject: BiometricPrompt.CryptoObject)

  fun onAuthenticationSuccessful(challenge: String, cryptoObject: FingerprintManagerCompat.CryptoObject)

  fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence)

  fun onAuthenticationError(errorCode: Int, errString: CharSequence)
}