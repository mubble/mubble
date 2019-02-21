package xmn

import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.error
import org.jetbrains.anko.info
import org.json.JSONObject
import util.AdhocTimer
import util.AndroidBase
import java.net.URL

/*------------------------------------------------------------------------------
   About      : Router to manage communication with mubble servers

   Created on : 17/01/18
   Author     : Raghvendra Varma

   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.

--------------------------------------------------------------------------------


------------------------------------------------------------------------------*/

abstract class XmnRouterAndroid(serverUrl: String, private val ci: ConnectionInfo,
                                private val si: SessionInfo, private val pubKey: ByteArray) : MubbleLogger {

  private var ongoingRequests : MutableList<RouterRequest> = mutableListOf()

  private var lastEventTs      = 0
  private var lastEventSendTs  = 0

  private var timerReqResend    : AdhocTimer?  = null
  private var timerReqTimeout   : AdhocTimer?  = null

  abstract fun getNetworkType(): String
  abstract fun getLocation(): String
  abstract fun getMaxOpenSecs(): Int
  abstract fun getCustomData(): CustomData?
  abstract fun updateCustomDataFromConfig(wo: WireObject)
  abstract fun handleEphEvent(wo: WireObject)
  abstract fun onSocketAbnormalClose(code: Int)

  companion object {

    private const val TIMEOUT_MS    : Long = 30000
    private const val SEND_RETRY_MS : Long = 1000
    private const val SEND_TIMEOUT  : Long = 10000
  }

  init {

    val url = URL(serverUrl)

    this.ci.protocol      = Protocol.WEBSOCKET
    this.ci.host          = url.host
    this.ci.port          = if (url.port != -1) url.port.toString() else { if (url.protocol == "https:") "443" else "80" }
    this.ci.publicRequest = this.getCustomData() == null

    if (!this.ci.publicRequest) {
      timerReqResend  = AdhocTimer("router-resend") { cbTimerReqResend() }
      timerReqTimeout = AdhocTimer("router-req-timeout") { cbTimerReqTimeout() }
    }
  }

  fun getPubKey(): ByteArray? {
    return this.pubKey
  }

  open fun cleanup() {

    if (this.si.provider != null) this.si.provider!!.cleanup()
    this.timerReqResend?.remove()
    this.timerReqTimeout?.remove()
  }

  fun setNetwork(netType: String) {

    if (netType != AndroidBase.NetworkType.ABSENT.value) {
      this.prepareConnection()
    }
  }

  open fun sendRequest(apiName: String, data: JSONObject, cb:((RouterResponse) -> Unit)?,
                       timeout: Long = TIMEOUT_MS) {

    val wr = WireRequest(apiName, data, System.currentTimeMillis() * 1000)

    this.ongoingRequests.add(RouterRequest(wr, cb, timeout))

    if (this.si.provider == null) this.prepareConnection()

    if (this.si.provider!!.send(arrayOf(wr)) == null) {
      wr.isSent = true
      info { "Sent request ${wr.toJsonObject()}" }
      timerReqTimeout?.tickAfter(timeout, true)

    } else {
      info { "Send to be retried ${wr.toJsonObject()}" }
      timerReqResend?.tickAfter(SEND_RETRY_MS, true)
    }
  }

  fun sendPersistentEvent(eventName: String, data: JSONObject) {

    if (this.si.provider == null) this.prepareConnection()
    val customData = this.ci.customData

    assert(customData != null && customData.clientId != 0L) {
      "You cannot send Persistent events without clientId"
    }

    val event = WireEvent(eventName, data, System.currentTimeMillis())

    if (this.si.provider!!.send(arrayOf(event)) == null) {
      info { "Sent event $event" }
    }
  }

  fun sendEphemeralEvent(eventName: String, data: JSONObject) {

    if (this.si.provider == null) this.prepareConnection()
    val customData = this.ci.customData

    assert(customData != null && customData.clientId != 0L) {
      "You cannot send Ephemeral events without clientId"
    }

    val event = WireEphEvent(eventName, data, System.currentTimeMillis())
    this.si.provider!!.sendEphemeralEvent(event)
  }

  fun prepareConnection() {

    info { "prepareConnection Provider: ${this.si.provider != null}" }

    this.ci.customData              = this.getCustomData()
    this.ci.customData?.location    = this.getLocation()
    this.ci.customData?.networkType = this.getNetworkType()
    this.ci.publicRequest           = this.ci.customData == null

    if (this.si.provider == null) this.si.provider = WsAndroid(this.ci, this.si, this)
  }

  fun providerReady() {
    cbTimerReqResend()
  }

  fun providerFailed(errorCode: String? = null) {

    while (this.ongoingRequests.isNotEmpty()) {
      val erCode = errorCode ?: if (!AndroidBase.isActiveNetwork(BaseApp.instance))
        XmnError.NetworkNotPresent
                                else XmnError.ConnectionFailed
      this.finishRequest(0, erCode)
    }

    this.ongoingRequests = mutableListOf()
    this.lastEventSendTs = 0
    this.lastEventTs     = 0
  }

  fun providerMessage(arData: MutableList<WireObject>) {

    for (i in 0 until arData.size) {

      val wo: WireObject = arData[i]
      info { "providerMessage@$i ${wo.toJsonObject()}" }

      when (wo.type) {

        WireType.REQUEST -> {
          error { "Not implemented $wo" }
        }

        WireType.EPH_EVENT -> {
          handleEphEvent(wo)
        }

        WireType.REQ_RESP -> {
          val resp   = wo as WireReqResp
          val reqObj = this.ongoingRequests.find { it.wr.ts == resp.ts }
          if (reqObj == null) {
            info { "Got response for request that is not in progress... timed-out? ${resp.name} sent at ${resp.ts}" }
            return
          }

          this.finishRequest(this.ongoingRequests.indexOf(reqObj), resp.errorCode, resp.errorMessage, resp.data)
        }

        WireType.SYS_EVENT -> {
          val resp = wo as WireSysEvent
          this.processSysEvent(resp)
        }

        else -> {
          error { "Unknown message $wo" }
        }
      }
    }

  }

  private fun processSysEvent(se: WireSysEvent) {

    info { "Came to processSysEvent ${se.toJsonObject()}" }

    if (se.name == SysEvent.WS_PROVIDER_CONFIG) {
      this.updateCustomDataFromConfig(se)
      this.prepareConnection()
    }

    this.si.provider!!.processSysEvent(se)
  }

  private fun cbTimerReqResend(): Long {

    val wr = this.ongoingRequests.find { !it.wr.isSent }
    if (wr == null || this.si.provider == null) return 0

    when {
      this.si.provider!!.send(arrayOf(wr.wr)) == null -> {
        wr.wr.isSent = true
        this.timerReqTimeout?.tickAfter(wr.timeout, true)
      }

      (System.currentTimeMillis() - wr.wr.ts/1000) > SEND_TIMEOUT -> {
        this.finishRequest(this.ongoingRequests.indexOf(wr), XmnError.SendTimedOut)
      }

      else -> return SEND_RETRY_MS
    }

    // We need to see if there are still messages left to be sent
    return if (this.ongoingRequests.find { !it.wr.isSent } != null) SEND_RETRY_MS else 0
  }

  private fun cbTimerReqTimeout(): Long {

    val now         = System.currentTimeMillis()
    var nextTimeout = Long.MAX_VALUE

    var i = 0
    while (i < this.ongoingRequests.size) {
      val wr        = this.ongoingRequests[i].wr
      val timeoutAt = wr.ts/1000 + this.ongoingRequests[i].timeout

      if (wr.isSent) {
        if (now >= timeoutAt) {
          this.finishRequest(i--, XmnError.RequestTimedOut)
        } else {
          if (nextTimeout > timeoutAt) nextTimeout = timeoutAt
        }
      }

      i++
    }

    return if (nextTimeout == Long.MAX_VALUE) 0 else nextTimeout - now
  }

  private fun finishRequest(index: Int, errorCode: String? = null, errorMessage: String? = null, dataObj: Any? = null) {

    val routerReq = this.ongoingRequests.removeAt(index)
    val now       = System.currentTimeMillis()

    if (routerReq.cb == null) {

      info { "Trying to finish already finished request, \n" +
             "ErrorCode $errorCode" +
             "${routerReq.wr.name}, created at: ${routerReq.wr.ts/1000}, \n" +
             "timeTaken: ${now - routerReq.wr.ts/1000} ms" }
      return
    }

    if (errorCode != null && errorCode != "null") {

      info { "Request failed with ErrorCode $errorCode, \n" +
          "${routerReq.wr.name}, created at: ${routerReq.wr.ts/1000}, \n" +
          "timeTaken: ${now - routerReq.wr.ts/1000} ms" }

      routerReq.cb!!(RouterResponse(errorCode, errorMessage))

    } else {

      info { "Request succeeded, \n" +
          "${routerReq.wr.name}, created at: ${routerReq.wr.ts/1000}, \n" +
          "timeTaken: ${now - routerReq.wr.ts/1000} ms"}

      routerReq.cb!!(RouterResponse(null, null, dataObj))
    }

    routerReq.cb = null
  }

}

class RouterRequest(val wr: WireRequest, var cb: ((RouterResponse) -> Unit)?, val timeout: Long)
