package `in`.mubble.android.bridge

import `in`.mubble.android.bridge.Bridge.State.*
import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.android.util.asyncExecuteInMainThread
import `in`.mubble.android.util.toTimeString
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.jetbrains.anko.warn
import org.json.JSONArray
import org.json.JSONObject
import java.util.*

/*------------------------------------------------------------------------------
   About      : Bridge to JS in WebView
   
   Created on : 01/12/17
   Author     : Raghvendra Varma
   
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

abstract class Bridge(protected val webView: WebView) : MubbleLogger {

  private   var nextRequestId       = 0
  private   val pendingRequestsMap  = mutableMapOf<String, AsyncCallbackStruct>()
  protected var state:State         = LOADING

  init {
    val timer = Timer()
    timer.scheduleAtFixedRate(TimeoutTimer(), REQUEST_TIMEOUT_MS.toLong(),
    REQUEST_TIMEOUT_MS.toLong())
  }

  fun asyncRequestToJs(requestName: String, vararg args: Any,
                       cb: (JSONObject) -> Unit): Unit {

    check(state > LOADING)

    asyncExecuteInMainThread {

      val requestTag   = "$requestName-${++nextRequestId}"

      pendingRequestsMap.put(requestTag, AsyncCallbackStruct(requestTag, cb))
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

  fun sendEventToJs(eventName: String, vararg args: Any?): Unit {

    asyncExecuteInMainThread {
      if (state !== LOADING) executeJsFunction("eventFromNative", eventName, *args) {}
    }
  }

  fun sendAsyncResponseToJs(requestId: Int, json: JSONObject) {

    asyncExecuteInMainThread {

      executeJsFunction("asyncResponseFromNative", requestId, json) {}
    }

  }

  private fun executeJsFunction(fnName: String, vararg args: Any?,
                                cb: (result: String) -> Unit) {

    val query = "$JS_INTERFACE.$fnName(${args.map {stringifyArg(it)}})"
    webView.evaluateJavascript(query, cb)
  }

  private fun stringifyArg(arg: Any?): String {

    return when(arg) {

      null            -> "null"

      is JSONArray,
      is JSONObject, // using single quote to avoid most of the escaping needs
      is String       -> """'${escapeSingleQuote(arg.toString())}'"""

      is Int,
      is Long         -> String.format("%d", arg)

      is Float,
      is Double       -> String.format("%f", arg)

      is Boolean      -> arg.toString()

      else            -> {check(false, {"$arg has invalid type"}); ""}
    }
  }

  private fun escapeSingleQuote(str: String): String {
    return str.replace("'", "\\'")
  }

  @JavascriptInterface
  protected fun asyncRequestResponseFromJs(requestTag: String, respJsonStr: String) {

    check(state > LOADING)

    asyncExecuteInMainThread {

      val json      = JSONObject(respJsonStr)
      val cbStruct  = pendingRequestsMap.remove(requestTag)

      if (cbStruct == null) {
        warn {"$requestTag is not found in pendingRequestsMap. Timed-out?"}
      } else {
        cbStruct.cb(json)
      }
    }
  }

  @JavascriptInterface
  fun setStateFromJs(strState: String) {

    val state: State = State.valueOf(strState)
    when(state) {
      INITIALIZED -> initializedFromJs()
      LOADING -> check(false, {"Automatically set"})
      SHOWN -> shownFromJs()
    }
  }

  protected fun initializedFromJs() {

    check(state === LOADING)

    asyncExecuteInMainThread {

      state = INITIALIZED

    }
  }

  protected open fun shownFromJs() {

    check(state === INITIALIZED)

    asyncExecuteInMainThread {
      state = SHOWN
    }
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
            warn { "TimeoutTimer: $key timed-out, was constructed at ${
              toTimeString(cbStruct.ts)}" }
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
}

