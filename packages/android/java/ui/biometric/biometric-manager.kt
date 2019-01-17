package ui.biometric

import android.content.Context
import android.content.DialogInterface
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.annotation.TargetApi
import android.os.CancellationSignal


class BiometricManager constructor() : BiometricManagerV23() {

  protected constructor(biometricBuilder : BiometricBuilder) : this() {

    this.context            = biometricBuilder.context
    this.title              = biometricBuilder.title
    this.subtitle           = biometricBuilder.subtitle
    this.description        = biometricBuilder.description
    this.negativeButtonText = biometricBuilder.negativeButtonText
  }

  fun authenticate(biometricCallback: BiometricCallback, failMsg: String) {

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

    displayBiometricDialog(biometricCallback, failMsg)
  }


  private fun displayBiometricDialog(biometricCallback: BiometricCallback, failMsg: String) {
    if (BiometricUtils.isBiometricPromptEnabled()) {
      displayBiometricPrompt(biometricCallback)
    } else {
      displayBiometricPromptV23(biometricCallback, failMsg)
    }
  }

  @TargetApi(Build.VERSION_CODES.P)
  private fun displayBiometricPrompt(biometricCallback: BiometricCallback) {
    BiometricPrompt.Builder(context)
        .setTitle(title!!)
        .setSubtitle(subtitle!!)
        .setDescription(description!!)
        .setNegativeButton(negativeButtonText!!, context!!.mainExecutor,
            DialogInterface.OnClickListener { _, _ -> biometricCallback.onAuthenticationCancelled() })
        .build()
        .authenticate(CancellationSignal(), context!!.mainExecutor,
            BiometricCallbackV28(biometricCallback))
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