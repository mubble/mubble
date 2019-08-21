package ui.biometric

import javax.crypto.Cipher

interface BiometricCallback {

  fun onSdkVersionNotSupported()

  fun onBiometricAuthenticationNotSupported()

  fun onBiometricAuthenticationNotAvailable()

  fun onBiometricAuthenticationPermissionNotGranted()

  fun onBiometricAuthenticationInternalError(error: String)


  fun onAuthenticationFailed()

  fun onAuthenticationCancelled()

  fun onAuthenticationSuccessful(challenge: String, cipher: Cipher)

  fun onAuthenticationHelp(helpCode: Int, helpString: CharSequence)

  fun onAuthenticationError(errorCode: Int, errString: CharSequence)
}