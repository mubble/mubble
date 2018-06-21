package xmn

import core.JsonSerializable
import org.json.JSONArray
import org.json.JSONObject

/**
 * Created by
 * siddharthgarg on 04/04/18.
 */

var lastReqId   : Long = 0L
var lastEventId : Long = 0L

object WebSocketUrl {
  const val ENC_PUBLIC    = "socket.io"
  const val ENC_PRIVATE   = "engine.io"
  const val PLAIN_PUBLIC  = "rocket.io"
  const val PLAIN_PRIVATE = "locket.io"
}

object WireType {
  const val REQUEST     = "REQUEST"
  const val EVENT       = "EVENT"
  const val SYS_EVENT   = "SYS_EVENT"
  const val EPH_EVENT   = "EPH_EVENT"
  const val EVENT_RESP  = "EVENT_RESP"
  const val REQ_RESP    = "REQ_RESP"
}

object SysEvent {
  const val UPGRADE_CLIENT_IDENTITY = "UPGRADE_CLIENT_IDENTITY"
  const val WS_PROVIDER_CONFIG      = "WS_PROVIDER_CONFIG"
  const val ERROR                   = "ERROR"
  const val PING                    = "PING"
}

object Encoder  {
  const val MIN_SIZE_TO_COMPRESS = 1000000
}

object Leader {
  const val BIN       = 'B'
  const val CONFIG    = 'C'
  const val DEF_JSON  = 'D'
  const val JSON      = 'J'
}

object XmnError {

  const val errorCode           = 555

  const val NetworkNotPresent   = "NetworkNotPresent"  // Network is absent
  const val ConnectionFailed    = "ConnectionFailed"   // server connect problem= server not running, no network, connection break
  const val RequestTimedOut     = "RequestTimedOut"    // ideally means api bug
  const val SendTimedOut        = "SendTimedOut"       // ideally means terribly slow connection
  const val UnAuthorized        = "UnAuthorized"       // When the client id is not valid (server to server)

  const val _NotReady           = "_NotReady"
}

open class WireObject(val type: String, val name: String, var data: Any,
                      open var ts: Long = System.currentTimeMillis()): JsonSerializable {

  companion object {

    fun getWireObject(json: JSONObject): Any? {

      val type  = json.getString("type")
      val name  = json.getString("name")
      val data  = json.opt("data")
      val ts    = json.getLong("ts")
      val error = json.optString("error", null)

      return when (type) {

        WireType.REQUEST     -> WireRequest(name, data, ts)
        WireType.SYS_EVENT   -> WireSysEvent(name, data)
        WireType.REQ_RESP    -> WireReqResp(name, data, ts, error)
        WireType.EPH_EVENT   -> WireEphEvent(name, data, ts)
        WireType.EVENT       -> WireEvent(name, data, ts)
        WireType.EVENT_RESP  -> WireEventResp(name, data, ts, error)
        else                 -> null
      }
    }
  }

  override fun toJsonObject(): JSONObject {

    val json = JSONObject()
    json.put("type", type)
    json.put("name", name)
    json.put("data", data)
    json.put("ts", ts)

    return json
  }

  fun stringify(): String {
    return toJsonObject().toString()
  }
}

class WireRequest(apiName: String, data: Any, override var ts: Long):
    WireObject(WireType.REQUEST, apiName, data, ts) {

  var isSent: Boolean = false

  init {
    if (ts <= 0) {
      if (ts == lastReqId) ts = lastReqId + 1
      lastReqId = ts
    }
  }
}

class WireReqResp(name: String, data: Any, ts: Long, val error: String? = null) :
    WireObject(WireType.REQ_RESP, name, data, ts), JsonSerializable {

  override fun toJsonObject(): JSONObject {

    val json = super.toJsonObject()
    if (error != null && error.isNotBlank() && error != "null") json.put("error", error)
    return json
  }
}

class WireEventResp(name: String, data: Any?, ts: Long, val error: String? = null):
    WireObject(WireType.EVENT_RESP, name, data?:JSONObject(), ts), JsonSerializable {

  override fun toJsonObject(): JSONObject {

    val json = super.toJsonObject()
    if (error != null && error.isNotBlank() && error != "null") json.put("error", error)
    return json
  }
}

class WireEvent(eventName: String, data: Any, override var ts: Long):
    WireObject(WireType.EVENT, eventName, data, ts) {

  init {
    if (ts <= 0) {
      if (ts == lastEventId) ts = lastEventId + 1
      lastEventId = ts
    }
  }
}

class WireSysEvent(name: String, data: Any)
  : WireObject(WireType.SYS_EVENT, name, data)

class WireEphEvent(eventName: String, data: Any, ts : Long)
  : WireObject(WireType.EPH_EVENT, eventName, data, ts)

class WebSocketConfig(data: Any) {
  val json            : JSONObject  = data as JSONObject
  val msPingInterval  : Long        = json.getLong("msPingInterval")
  val syncKey         : String?     = json.optString("syncKey", null)
}

class ConnectionError(data: Any) {
  val json  : JSONObject  = data as JSONObject
  val code  : String      = json.optString("code", "")
  val msg   : String      = json.optString("msg", "")
}

class RouterResponse(val errorCode: String?, val data: Any? = null): JsonSerializable {

  private var events : MutableList<WireObject> = mutableListOf()

  fun addEvents(events: MutableList<WireObject>) {
    this.events.addAll(events)
  }

  override fun toJsonObject(): JSONObject {

    val eventsArr = JSONArray()
    events.forEach {
      eventsArr.put(it.toJsonObject())
    }

    val json = JSONObject()
    json.put("errorCode", errorCode)
    json.put("data", data)
    json.put("events", eventsArr)

    return json
  }
}

interface XmnProvider {
  fun send(data: Array<WireObject>): String?
}
