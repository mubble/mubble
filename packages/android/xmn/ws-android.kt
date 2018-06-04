package `in`.mubble.android.xmn

import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.android.util.AdhocTimer
import org.java_websocket.WebSocket
import org.java_websocket.util.Base64
import org.jetbrains.anko.info
import org.jetbrains.anko.warn
import org.json.JSONObject
import xmn.*
import java.lang.Exception
import java.net.URI
import java.net.URLEncoder
import java.nio.ByteBuffer

/**
 * Created by raghavv on 14/11/17.
 *
 * https://github.com/TooTallNate/Java-WebSocket/blob/master/src/main/java/org/java_websocket/client/WebSocketClient.java
 *
 */
class WsAndroid(private val ci: ConnectionInfo, private val router: XmnRouterAndroid)
    : XmnProvider, MubbleLogger, WsListener {

  private var ws                : WsClient? = null
  private var encProvider       : EncProviderAndroid? = null
  private var timerPing         : AdhocTimer? = null

  private var socketCreateTs    : Long    = 0
  private var lastMessageTs     : Long    = 0
  private var msPingInterval    : Long    = 29000 // Must be a valid number

  private var sending           : Boolean = false
  private var configured        : Boolean = false
  private var preConfigQueue    : MutableList<ByteBuffer> = mutableListOf()

  private var ephemeralEvents   : MutableList<WireEphEvent> = mutableListOf()

  init {
    timerPing = AdhocTimer("ws-ping", { cbTimerPing() } ) // Being created in the main thread
  }

  fun sendEphemeralEvent(event: WireEphEvent) {

    assert(this.ci.provider != null)

    if (ephemeralEvents.size >= 20) {
      warn { "Too many ephemeralEvents. Sizing to 20" }
      while (ephemeralEvents.size >= 20) this.ephemeralEvents.removeAt(0)
    }

    this.ephemeralEvents.add(event)
  }

  @Suppress("IMPLICIT_CAST_TO_ANY")
  override fun send(data: Array<WireObject>): String? {

    val ws = this.ws

    if ( this.sending ||
        (ws != null && (ws.readyState !== WebSocket.READYSTATE.OPEN || !this.configured || ws.hasBufferedData())) ) {

      info { "WebSocket is not ready right now \n" +
             "anotherSendInProgress  : ${this.sending}, \n" +
             "configured             : ${this.configured}, \n" +
             "readyState             : ${if (ws != null) ws.readyState else "to be created"}, \n" +
             "bufferedAmount         : ${ws!!.hasBufferedData()} " }

      return XmnError._NotReady
    }

    this.sendInternal(data)
    return null
  }

  private fun sendInternal(data: Array<WireObject>) {

    this.sending = true

    val msgBodyLen: Int

    if (this.ws == null) {

      if (this.encProvider == null) {
        this.encProvider = EncProviderAndroid(router.syncKey ?: ByteArray(0), this.ci)
      }

      val dest    = if (this.ci.publicRequest) WebSocketUrl.PLAIN_PUBLIC else WebSocketUrl.PLAIN_PRIVATE
      val url     = "${if (this.ci.port == 443) "wss" else "ws"}://${this.ci.host}:${this.ci.port}/$dest/"
      val header  = this.encProvider!!.encodeHeader()
      val body    = this.encProvider!!.encodeBody(data)

      val msgBody = URLEncoder.encode(Base64.encodeBytes(header), "UTF-8") + "/" +
                    URLEncoder.encode(Base64.encodeBytes(body), "UTF-8")

      msgBodyLen = msgBody.length

      val uri = URI(url + msgBody)
      this.ws = WsClient(uri, this)
      this.ws!!.connect()

      info { "Opened socket with url $url" }
      this.socketCreateTs = System.currentTimeMillis()

    } else {
      val body   = this.encProvider!!.encodeBody(data)
      msgBodyLen = body.size
      this.ws!!.send(body)
    }

    this.lastMessageTs = System.currentTimeMillis()

    info { "Sent message: \n" +
            "msgLen   : $msgBodyLen, \n" +
            "messages : ${data.size}, \n" +
            "firstMsg : ${data[0].name}" }

    this.setupTimer()
    this.sending = false
  }

  override fun onOpen() {

    info { "onOpen in ${System.currentTimeMillis() - this.socketCreateTs} ms" }
    this.router.providerReady()
  }

  override fun onMessage(message: String?) {
    info { "onMessage" }
  }

  override fun onMessage(bytes: ByteBuffer?) {

    info { "onMessage" }

    if (bytes == null) return

    val byteArr : ByteArray = bytes.array()

    if (!this.configured) {
      val leader : Char = String(byteArr)[0]

      if (leader != Leader.CONFIG) {
        info { "Queued message length: ${byteArr.size}" }
        this.preConfigQueue.add(bytes)
        return
      }
    }

    val messages: MutableList<WireObject> = this.encProvider!!.decodeBody(byteArr)
    this.router.providerMessage(messages)
  }

  override fun onCloseInitiated(code: Int, reason: String?) {
    info { "onCloseInitiated" }
  }

  override fun onClosing(code: Int, reason: String?, remote: Boolean) {
    info { "onClosing" }
  }

  override fun onClose(code: Int, reason: String?) {

    info { "onClose" }
    if (this.ci.provider != null) {
      this.cleanup()
      this.router.providerFailed()
    }
  }

  override fun onError(ex: Exception?) {

    info { "onError ${ex!!.printStackTrace()}" }
    if (this.ci.provider != null) {
      this.cleanup()
      this.router.providerFailed()
    }
  }

  fun processSysEvent(se: WireSysEvent) {

    info { "processSysEvent ${se.name}" }

    if (se.name == SysEvent.WS_PROVIDER_CONFIG) {

      val config  = WebSocketConfig(se.data)
      val msPing  = config.msPingInterval

      this.msPingInterval = msPing

      assert(msPing > 0)

      if (!config.syncKey.isNullOrBlank()) {
        this.encProvider!!.setNewKey(config.syncKey!!)
      }

      info { "First message in ${System.currentTimeMillis() - socketCreateTs} ms" }

      this.configured = true

      for (i in 0 until this.preConfigQueue.size) {
        val message = this.preConfigQueue[i]
        this.onMessage(message)
      }

      this.preConfigQueue = mutableListOf()

    } else if (se.name == SysEvent.ERROR) {

      val errMsg = ConnectionError(se.data)
      warn { "processSysEvent $errMsg" }
      if (this.ci.provider != null) {
        this.cleanup()
        this.router.providerFailed(errMsg.code)
      }
    }
  }

  private fun setupTimer() {

    this.timerPing!!.tickAfter(this.msPingInterval, true)
  }

  private fun cbTimerPing(): Long {

    if (this.ci.provider == null) return 0

    val now   = System.currentTimeMillis()
    val diff  = this.lastMessageTs + this.msPingInterval - now

    return if (diff <= 0) {
      this.send(arrayOf(WireSysEvent(SysEvent.PING, JSONObject())))
      this.msPingInterval

    } else {
      diff
    }
  }

  fun cleanup() {

    if (this.ci.provider == null) return

    try {
      this.timerPing!!.remove()

      this.encProvider  = null
      this.ci.provider  = null

      if (this.ws != null) this.ws!!.close()
      this.ws           = null

    } catch (e: Exception) {}
  }
}