package ui.base

import org.json.JSONObject
import xmn.XmnRouterAndroid

abstract class MubbleBaseWebActivity : MubbleBaseActivity() {

  // Web JS Callbacks
  abstract fun shownFromJs()

  // Dependencies
  abstract fun getRouter(): XmnRouterAndroid?
  abstract fun getUtilManager(): ActivityUtilManagerBase?

  // Analytics
  abstract fun setUserId(userId: String)
  abstract fun setUserProperty(key: String, value: String)
  abstract fun logEvent(eventName: String, bundle: String)

  // Fingerprint
  abstract fun fingerprintScan(challenge: String, cb: (JSONObject) -> Unit)

  // Camera
  abstract fun takePicture(aspectRatio: String, cb: (JSONObject) -> Unit)
  abstract fun selectPicture(cb: (JSONObject) -> Unit)

  // Phone / SMS
  abstract fun startSmsRetriever(cb: (JSONObject) -> Unit)

  // File I/O
  abstract fun openPdfViewer(pdfBase64: String)

  // Scan
  abstract fun takeSignature(invSource: String, cb: (JSONObject) -> Unit)
  abstract fun scanQrCode(invSource: String, title: String, cb: (JSONObject) -> Unit)
  abstract fun scanBarcode(invSource: String, cb: (JSONObject) -> Unit)

  // Permission
  abstract fun getPermission(permission: String, showRationale: Boolean, cb: (JSONObject) -> Unit)

  // Util Callbacks
  abstract fun onMobileBrowserClosed()
}