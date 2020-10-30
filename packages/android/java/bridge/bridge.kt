package bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import bridge.Bridge.State.*
import core.BaseApp
import core.DeviceInfo
import core.MubbleLogger
import org.jetbrains.anko.info
import org.jetbrains.anko.warn
import org.json.JSONArray
import org.json.JSONObject
import ui.base.MubbleBaseWebActivity
import ui.permission.PermissionGroup
import util.*
import java.util.*

/*------------------------------------------------------------------------------
   About      : Bridge to JS in WebView

   Created on : 01/12/17
   Author     : Raghvendra Varma

   Updated on : 15/10/20
   Author     : Siddharth

   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

/*------------------------------------------------------------------------------

  Running JS functions:
  ---------------------
  'Bridging to JS' is essentially via 'eval of JS code', that runs in 'the
  JS environment' in context of the 'default thread' in JS. As this thread is
  different from Java thread, the 'eval script' is posted to JS environment and
  it's result is received asynchronously. To have a simpler interface, we only
  support Async invoke of function, irrespective of function returning Promise

  Hosting functions that are called from JS
  -----------------------------------------
  To interact with WebView, native side runs a separate 'webView' thread.
  This thread is used to execute the functions that are annotated with
  @JavascriptInterface. Each of these functions are also inserted into an object
  that is available in JS environment. The calls from JS to native are executed
  synchronously when they can be fulfilled in 'webView' thread. If there is a need
  of executing the function in 'UI thread' or 'need to wait', these function
  results are returned in async. Hence execution of function from JS to Native,
  are both sync and async
  JavascriptInterface only supports primitive types


------------------------------------------------------------------------------*/

private const val JS_INTERFACE        = "fromCordova"
private const val REQUEST_TIMEOUT_MS  = 15000

@Suppress("UNUSED")
abstract class Bridge(protected val app       : BaseApp,
                      protected val webView   : WebView,
                      protected val webBridge : MubbleBaseWebActivity) : MubbleLogger {

  private   var nextRequestId       = 0
  private   val pendingRequestsMap  = mutableMapOf<String, AsyncCallbackStruct>()
  protected var state: State        = LOADING

  protected val isActivityChild = webView.context is Activity

  init {
    val timer = Timer()
    timer.scheduleAtFixedRate(TimeoutTimer(), REQUEST_TIMEOUT_MS.toLong(),
    REQUEST_TIMEOUT_MS.toLong())
  }

  fun asyncRequestToJs(requestName: String, vararg args: Any,
                       cb: (JSONObject) -> Unit) {

    check(state > LOADING)

    asyncExecuteInMainThread {

      val requestTag = "$requestName-${++nextRequestId}"

      pendingRequestsMap[requestTag] = AsyncCallbackStruct(requestTag, cb)
      executeJsFunction("asyncRequestFromNative", requestName, requestTag, *args) {}
    }
  }

  /*
    Events are special concept. Events can be sent to the JS env
    after it is State.Initialized. Events are queued till then.

    For every event generated from Native, there must be a onEventName function
    in JS, that receives the parameters sent by native. There is no acknowledgement
    of event
   */

  fun sendEventToJs(eventName: String, vararg args: Any?) {

    asyncExecuteInMainThread {
      if (state !== LOADING) executeJsFunction("eventFromNative", eventName, *args) {}
    }
  }

  fun sendAsyncResponseToJs(requestId: Int, json: JSONObject = JSONObject()) {

    asyncExecuteInMainThread {
      executeJsFunction("asyncResponseFromNative", requestId, json) {}
    }
  }

  private fun executeJsFunction(fnName: String, vararg args: Any?,
                                cb: (result: String) -> Unit) {

    val query = "$JS_INTERFACE.$fnName(${(args.map {stringifyArg(it)}).joinToString()})"

    info {"executeJsFunction: $fnName ${(args.map {stringifyArg(it)}).joinToString()}"}
    if (webView.isAttachedToWindow) webView.evaluateJavascript(query, cb)
  }

  protected fun getResponseLambda(requestId: Int, requestName: String): (JSONObject) -> Unit {

    return {
      jsonObject ->
      info {"Sending async response to JS for $requestName/$requestId as $jsonObject"}
      sendAsyncResponseToJs(requestId, jsonObject)
    }
  }

  private fun stringifyArg(arg: Any?): String {

    return when(arg) {

      null            -> "null"

      // using single quote to avoid most of the escaping needs
      is String       -> "'${escapeSingleQuote(arg.toString())}'"

      is Int,
      is Long         -> String.format("%d", arg)

      is Float,
      is Double       -> String.format("%f", arg)

      is JSONArray,
      is JSONObject,
      is Boolean      -> arg.toString()

      else            -> {check(false) {"$arg has invalid type"}; ""}
    }
  }

  private fun escapeSingleQuote(str: String): String {
    return str.replace("'", "\\'")
  }

  @JavascriptInterface
  fun asyncRequestResponseFromJs(requestTag: String, respJsonStr: String) {

    check(state > LOADING)

    asyncExecuteInMainThread {

      val json = JSONObject(respJsonStr)
      val cbStruct = pendingRequestsMap.remove(requestTag)

      if (cbStruct == null) {
        warn { "$requestTag is not found in pendingRequestsMap. Timed-out?" }
      } else {
        cbStruct.cb(json)
      }
    }
  }

  @JavascriptInterface
  fun setStateFromJs(requestId: Int, strState: String) {

    when(valueOf(strState)) {
      INITIALIZED -> initializedFromJs()
      LOADING -> check(false) {"Automatically set"}
      SHOWN -> shownFromJs()
    }

    sendAsyncResponseToJs(requestId)
  }

  private fun initializedFromJs() {

    check(state === LOADING)

    asyncExecuteInMainThread {
      state = INITIALIZED
    }
  }

  @JavascriptInterface
  fun shownFromJs() {

    check(state === INITIALIZED)

    asyncExecuteInMainThread {
      state = SHOWN
      if (isActivityChild) {
        val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
        activity.shownFromJs()
      }
    }
  }

  fun isStateShown(): Boolean {
    return state == SHOWN
  }

  // TimeoutTimer to timeout requests that are not responded in time
  private inner class TimeoutTimer : TimerTask() {

    override fun run() {

      if (pendingRequestsMap.isEmpty()) return

      val now  = System.currentTimeMillis()
      val then = now - REQUEST_TIMEOUT_MS

      asyncExecuteInMainThread {

        val iterator = pendingRequestsMap.iterator()

        while (iterator.hasNext()) {
          val (key, cbStruct) = iterator.next()
          if (cbStruct.ts < then) {
            warn {
              "TimeoutTimer: $key timed-out, was constructed at ${
              UtilBase.toTimeString(cbStruct.ts)}"
            }
            iterator.remove()
          }
        }
      }
    }
  }

  // Data class to hold async callback lambdas
  private data class AsyncCallbackStruct(val requestTag : String,
                                         val cb         : (JSONObject) -> Unit) {
    val ts = System.currentTimeMillis()
  }

  protected enum class State {
    LOADING,      // The js files are getting parsed and loaded in memory
    INITIALIZED,  // Code initialized and the bridge is up
    SHOWN         // UI being displayed, albeit busy in server requests
  }

/*------------------------------------------------------------------------------
    Init Data
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun getInitData(requestId: Int, initConfig: JSONObject, launchContext: JSONObject) {

    check(isActivityChild)

    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    val connAttr = JSONObject()
    connAttr.put("netType", AndroidBase.getCurrentNetworkType(app))
    connAttr.put("location", AndroidBase.getCurrentLocation(activity))

    val obj = JSONObject()
    obj.put("initConfig", initConfig)
    obj.put("launchContext", launchContext)
    obj.put("connAttr", connAttr)

    sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  fun getDeviceInfo(requestId: Int) {
    sendAsyncResponseToJs(requestId, DeviceInfo.getData())
  }

/*------------------------------------------------------------------------------
    Session APIs
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun getSessionInfo(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    val canAuth = activity.getUtilManager()?.canAuthWithFingerprint()?:false

    syncExecuteInMainThread {
      activity.getRouter()?.getSessionInfo(canAuth, getResponseLambda(requestId,
          "getSessionInfo"))
    }
  }

  @JavascriptInterface
  fun recreateSession(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    val canAuth = activity.getUtilManager()?.canAuthWithFingerprint()?:false

    syncExecuteInMainThread {
      activity.getRouter()?.createSession(canAuth, getResponseLambda(requestId,
          "recreateSession"))
    }
  }

/*------------------------------------------------------------------------------
    Analytics
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun setUserId(requestId: Int, userId: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.setUserId(userId)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun setUserProperty(requestId: Int, key: String, value: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.setUserProperty(key, value)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun logEvent(requestId: Int, eventName: String, bundle: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.logEvent(eventName, bundle)
    sendAsyncResponseToJs(requestId)
  }

/*------------------------------------------------------------------------------
    LOCAL STORAGE - GLOBAL, USER & CONFIG
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun setUserKeyValue(requestId: Int, key: String, value: String?) {
    app.userKeyVal.setValue(key, value)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun getUserKeyValue(requestId: Int, key: String) {

    val obj = JSONObject()
    obj.put("value", app.userKeyVal.getValue(key))
    sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  fun setGlobalKeyValue(requestId: Int, key: String, value: String?) {
    app.globalKeyVal.setValue(key, value)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun getGlobalKeyValue(requestId: Int, key: String) {

    val obj = JSONObject()
    obj.put("value", app.globalKeyVal.getValue(key))
    sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  fun setGcConfig(requestId: Int, config: String) {

    app.configKeyVal.setConfig(config)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun getGcConfig(requestId: Int, category: String, key: String) {

    val obj = JSONObject()
    obj.put("value", app.configKeyVal.getConfig(category, key))
    sendAsyncResponseToJs(requestId, obj)
  }


/*------------------------------------------------------------------------------
    XMN REQUESTS
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun sendRequest(requestId: Int, api: String, paramsStr: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    asyncExecuteInMainThread {
      val params = JSONObject(paramsStr)
      activity.getRouter()?.sendRequest(api, params, {
        getResponseLambda(requestId, "sendRequest")(it.toJsonObject())
      })
    }
  }

  @JavascriptInterface
  fun sendEvent(requestId: Int, eventName: String, paramsStr: String, ephemeral: Boolean) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    asyncExecuteInMainThread {
      activity.getRouter()?.sendEvent(eventName, JSONObject(paramsStr), ephemeral)
      sendAsyncResponseToJs(requestId)
    }
  }

  @JavascriptInterface
  fun prepareConnection(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    syncExecuteInMainThread {
      activity.getRouter()?.prepareConnection()
      sendAsyncResponseToJs(requestId, JSONObject())
    }
  }

/*------------------------------------------------------------------------------
    Fingerprint
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun canAuthWithFingerprint(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    val obj = JSONObject()
    obj.put("canAuth", activity.getUtilManager()?.canAuthWithFingerprint()?:false)
    return sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  fun generateFpKeyPair(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    val pubKey = activity.getUtilManager()?.generateFpKeyPair()

    val obj = JSONObject()
    obj.put("pubKey", pubKey)
    sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  fun fingerprintScan(requestId: Int, data: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity

    syncExecuteInMainThread {
      activity.fingerprintScan(data) {
        sendAsyncResponseToJs(requestId, it)
      }
    }
  }

/*------------------------------------------------------------------------------
    Camera
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun takePictureFromCamera(requestId: Int, aspectRatio: String = "") {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.takePicture(aspectRatio, getResponseLambda(requestId, "takePictureFromCamera"))
  }

  @JavascriptInterface
  fun selectPictureFromGallery(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.selectPicture(getResponseLambda(requestId, "selectPictureFromGallery"))
  }

/*------------------------------------------------------------------------------
    Permission
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun getPermission(requestId: Int, permission: String, showRationale: Boolean) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getPermission(permission, showRationale, getResponseLambda(requestId, "getPermission"))
  }

  @JavascriptInterface
  fun hasPermission(requestId: Int,permission: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    val group = PermissionGroup.getGroup(permission)
    val obj = JSONObject()
    obj.put("hasPerm", group!!.hasPermission(activity))
    sendAsyncResponseToJs(requestId, obj)
  }

/*------------------------------------------------------------------------------
    File I/O
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun saveBinaryFile(requestId: Int, filePath: String, fileName: String, base64Data: String) {

    FileBase.asyncWriteFileToInternal(filePath, fileName, Base64.decode(base64Data, Base64.NO_WRAP))
    val jsonObject = JSONObject()
    jsonObject.put("success", true)
    sendAsyncResponseToJs(requestId, jsonObject)
  }

  @JavascriptInterface
  fun selectDocumentFile(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.selectDocument(activity, getResponseLambda(requestId, "selectDocumentFile"))
  }

  @JavascriptInterface
  fun openPdfViewer(requestId : Int, pdfBase64 : String) {
    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.openPdfViewer(pdfBase64)
    sendAsyncResponseToJs(requestId)
  }

/*------------------------------------------------------------------------------
    Phone / SMS
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun placeCall(requestId: Int, mobileNumber: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$mobileNumber"))
    activity.startActivity(intent)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun listenForSmsCode(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.startSmsRetriever {
      sendAsyncResponseToJs(requestId, it)
    }
  }

  @JavascriptInterface
  fun requestMobNumHint(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.requestMobNumHint(activity, getResponseLambda(requestId,
        "requestMobNumHint"))
  }

  @JavascriptInterface
  fun getPhoneContacts(requestId: Int) {
    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()!!.getContacts(activity) {
      val obj = JSONObject()
      obj.put("contacts", it)
      sendAsyncResponseToJs(requestId, obj)
    }

    //AndroidBase.getPhoneContacts(activity, getResponseLambda(requestId, "getPhoneContacts"))
  }

/*------------------------------------------------------------------------------
    Scan
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun takeSignature(requestId: Int, invSource: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    asyncExecuteInMainThread {
      activity.takeSignature(invSource, getResponseLambda(requestId,
          "takeSignature"))
    }
  }

  @JavascriptInterface
  fun scanQrCode(requestId: Int, invSource: String, title: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    asyncExecuteInMainThread {
      activity.scanQrCode(invSource, title, getResponseLambda(requestId,
          "scanQrCode"))
    }
  }

  @JavascriptInterface
  fun scanBarcode(requestId: Int, invSource: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    asyncExecuteInMainThread {
      activity.scanBarcode(invSource, getResponseLambda(requestId,
          "scanBarcode"))
    }
  }

/*------------------------------------------------------------------------------
    Common Utils
------------------------------------------------------------------------------*/

  @JavascriptInterface
  fun setDebuggable(requestId: Int) {

    asyncExecuteInMainThread {

      check(isActivityChild)
      WebView.setWebContentsDebuggingEnabled(true)
      sendAsyncResponseToJs(requestId)
    }
  }

  @JavascriptInterface
  fun showToast(inToast: String) {

    asyncExecuteInMainThread {
      Toast.makeText(app, inToast, Toast.LENGTH_SHORT).show()
    }
  }

  @JavascriptInterface
  fun closeApp(requestId: Int) {
    check(isActivityChild) {"closeApp requested when not running as activity"}
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    asyncExecuteInMainThread {
      sendAsyncResponseToJs(requestId)
      activity.finish()
    }
  }

  @JavascriptInterface
  fun closeMobileBrowser(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.closeMobileBrowser(activity)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun openInMobileBrowser(requestId: Int, url: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.openInMobileBrowser(activity, url)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun launchAppMarket(requestId: Int, packageName : String?) {

    var pckgName = app.packageName
    if (!packageName.isNullOrBlank()) pckgName = packageName

    AndroidBase.invokePlayStore(app, pckgName)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun reinstallFromAppMarket(requestId: Int) {
    AndroidBase.invokePlayStore(app, app.packageName)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun sendMail(requestId: Int, toAddr: String, subject: String, body: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    asyncExecuteInMainThread {
      AndroidBase.sendMail(activity, toAddr, subject, body)
      sendAsyncResponseToJs(requestId)
    }
  }

  @JavascriptInterface
  fun launchNavigationOnMap(requestId: Int, lat:String, lng:String) {
    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.requestToStartNavigation(activity, lat,lng)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun copyToClipBoard(requestId: Int, textToCopy: String) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    UtilBase.copyToClipBoard(activity, textToCopy)
    showToast("Copied to clipboard")
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun openSoftInputKeyboard(requestId: Int) {

    check(isActivityChild)
    UtilBase.openSoftInputKeyboard()
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun hideSoftInputKeyboard(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    UtilBase.hideSoftInputKeyboard(activity)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun checkIfPkgInstalled(requestId: Int, pkgName: String) {

    val obj = JSONObject()
    obj.put("installed", AndroidBase.checkIfPckgInstalled(pkgName))
    sendAsyncResponseToJs(requestId, obj)
  }

  @JavascriptInterface
  open fun resetApp(requestId: Int) {

    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    AndroidBase.resetApp(activity)
    sendAsyncResponseToJs(requestId)
  }

  @JavascriptInterface
  fun getCurrentLocation(requestId: Int) {
    check(isActivityChild)
    val activity: MubbleBaseWebActivity = webView.context as MubbleBaseWebActivity
    activity.getUtilManager()?.getCurrentLocation(activity) {
      sendAsyncResponseToJs(requestId, it)
    }
  }

}

