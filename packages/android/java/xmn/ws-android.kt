package xmn

import core.MubbleLogger
import org.jetbrains.anko.info
import org.jetbrains.anko.warn
import org.json.JSONObject
import util.AdhocTimer
import java.net.URI
import java.net.URLEncoder

/**
 * Created by raghavv on 14/11/17.
 *
 * https://github.com/TooTallNate/Java-WebSocket/blob/master/src/main/java/org/java_websocket/client/WebSocketClient.java
 *
 */
class WsAndroid(private val ci: ConnectionInfo,
                private val router: XmnRouterAndroid) : XmnProvider, MubbleLogger, WsListener {

  private var ws                : WsClient?           = null
  private var encProvider       : EncProviderAndroid? = null
  private var pendingMessage    : Array<WireObject>?  = null
  private var wsProviderConfig  : WsProviderConfig?   = null

  private var timerPing         : AdhocTimer?         = null

  private var socketCreateTs    : Long    = 0
  private var lastMessageTs     : Long    = 0

  private var sending           : Boolean = false
  private var configured        : Boolean = false
  private var connExpired       : Boolean = false

  private var ephemeralEvents   : MutableList<WireEphEvent> = mutableListOf()

  companion object {

    private const val PING_SECS       = 29
    private const val TOLERANCE_SECS  = 5
  }

  init {

    val isPrivateConn = router.getCustomData() != null
    if (isPrivateConn) timerPing = AdhocTimer("ws-ping") { cbTimerPing() }
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

    val datas = mutableListOf<WireObject>()

    datas.addAll(data)

    if ( this.sending ||
        (this.ws != null && (!this.ws!!.checkStateReady() || !this.configured || this.ws!!.hasBufferedData())) ) {

      info { "WebSocket is not ready right now \n" +
             "anotherSendInProgress  : ${this.sending}, \n" +
             "configured             : ${this.configured}, \n" +
             "readyState             : ${if (this.ws != null) this.ws!!.readyStateName() else "to be created"}, \n" +
             "bufferedAmount         : ${ws?.hasBufferedData()} " }

      return XmnError._NotReady
    }

    for (event in this.ephemeralEvents) datas.add(event)
    this.ephemeralEvents = mutableListOf()

    info { "Request Made: ${data[0].toJsonObject()}" }

    this.sendInternal(datas.toTypedArray())
    return null
  }

  private fun sendInternal(data: Array<WireObject>) {

    this.sending = true

    val msgBodyLen: Int

    if (this.ws == null) {

      this.pendingMessage = data

      if (this.encProvider == null) {
        this.encProvider = EncProviderAndroid(this.ci, router.getPubKey(), router.getIvSpec())
      }

      if (this.wsProviderConfig == null) {
        this.wsProviderConfig = WsProviderConfig(PING_SECS, this.router.getMaxOpenSecs(), TOLERANCE_SECS,
            this.encProvider!!.getSyncKeyB64(), this.ci.customData)
      }

      val protocol = if(this.ci.port == 443 || this.router.runAlwaysAsSecure()) "wss" else "ws"
      val url      = "$protocol://${this.ci.host}:${this.ci.port}/$PROTOCOL_HANDSHAKE/${this.ci.protocolVersion}/${this.ci.shortName}/"
      val header   = this.encProvider!!.encodeHeader(wsProviderConfig!!)
      val msgBody  = URLEncoder.encode(header, "UTF-8")

      msgBodyLen = msgBody.length

      val uri = URI(url + msgBody)
      this.ws = WsClient(uri, this)
      this.ws!!.connect()

      info { "Opened socket with url ${url + msgBody}" }
      this.socketCreateTs = System.currentTimeMillis()

    } else {

      if (!isConnWithinPing(System.currentTimeMillis())) {
        info { "Connection expired..requesting socket close" }
        this.sending      = false
        this.connExpired  = true
        this.requestClose()
        return
      }

      val body   = this.encProvider!!.encodeBody(data)
      msgBodyLen = body.size
      this.ws!!.send(body)

      info { "Sent message: \n" +
          "msgLen   : $msgBodyLen, \n" +
          "messages : ${data.size}, \n" +
          "firstMsg : ${data[0].name}" }
    }

    this.lastMessageTs = System.currentTimeMillis()

    this.timerPing?.tickAfter(this.wsProviderConfig!!.pingSecs * 1000L, true)
    this.sending = false
  }

  override fun onOpen() {

    info { "onOpen in ${System.currentTimeMillis() - this.socketCreateTs} ms" }
    this.router.providerReady()
  }

  override fun onMessage(message: String?) {
    info { "onMessage" }
  }

  override fun onMessage(bytes: ByteArray?) {

    info { "onMessage" }

    if (bytes == null || bytes.isEmpty() || this.ci.provider == null) return
    val messages: MutableList<WireObject> = this.encProvider!!.decodeBody(bytes)
    this.router.providerMessage(messages)
  }

  override fun onCloseInitiated(code: Int?, reason: String?) {
    info { "onCloseInitiated" }
  }

  override fun onClosing(code: Int?, reason: String?, remote: Boolean?) {
    info { "onClosing" }
  }

  override fun onClose(code: Int?, reason: String?) {

    info { "onClose $code" }
    if (this.ci.provider != null) {
      this.cleanup()
      this.router.providerFailed(if (this.connExpired) XmnError._ConnectionExpired else null)
    }

    if (code != null && (code > 0 && code != 1000)) {
      this.router.onSocketAbnormalClose(code)
    }
  }

  override fun onError(ex: Exception?) {

    info { "onError ${ex?.message}" }
    if (this.ci.provider != null) {
      this.cleanup()
      this.router.providerFailed()
    }
  }

  fun processSysEvent(se: WireSysEvent) {

    info { "processSysEvent ${se.name}" }

    if (se.name == SysEvent.WS_PROVIDER_CONFIG) {

      val config = WsProviderConfig(se.data as JSONObject)

      if (config.custom != null) this.wsProviderConfig!!.custom = config.custom
      if (config.pingSecs != 0) this.wsProviderConfig!!.pingSecs = config.pingSecs
      if (config.maxOpenSecs != 0) this.wsProviderConfig!!.maxOpenSecs = config.maxOpenSecs
      if (config.toleranceSecs != 0) this.wsProviderConfig!!.toleranceSecs = config.toleranceSecs

      if (!config.key.isNullOrBlank()) {
        this.encProvider!!.setNewKey(config.key!!)
      }

      info { "First message in ${System.currentTimeMillis() - socketCreateTs} ms" }

      this.configured = true

      if (this.pendingMessage != null) {
        info { "Sending Pending Message..." }
        this.send(this.pendingMessage!!)
        this.pendingMessage = null
      }

    } else if (se.name == SysEvent.ERROR) {

      val errMsg = ConnectionError(se.data)
      warn { "processSysEvent $errMsg" }
      if (this.ci.provider != null) {
        this.cleanup()
        this.router.providerFailed(errMsg.code)
      }
    }
  }

  private fun cbTimerPing(): Long {

    if (this.ci.provider == null) return 0

    val now   = System.currentTimeMillis()
    val diff  = this.lastMessageTs + this.wsProviderConfig!!.pingSecs * 1000L - now

    return if (diff <= 0) {
      this.send(arrayOf(WireSysEvent(SysEvent.PING, JSONObject())))
      this.wsProviderConfig!!.pingSecs * 1000L

    } else {
      diff
    }
  }

  private fun isConnWithinPing(requestTs: Long): Boolean {

    val wsConfig = this.wsProviderConfig!!
    val pingTh   = this.lastMessageTs + (wsConfig.pingSecs + wsConfig.toleranceSecs) *1000
    val openTh   = this.socketCreateTs + (wsConfig.maxOpenSecs - wsConfig.toleranceSecs) * 1000

    return requestTs < pingTh && requestTs < openTh
  }

  fun cleanup() {

    if (this.ci.provider == null) return

    try {
      this.timerPing?.remove()

      this.encProvider  = null
      this.ci.provider  = null

      this.ws?.close()
      this.ws = null

    } catch (e: Exception) {}
  }

  fun requestClose() {

    if (this.ws != null && this.ws!!.checkStateReady()) {
      this.ws!!.close()
    }
  }
}