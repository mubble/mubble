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

const val PROTOCOL_VERSION    = "v2"
const val PROTOCOL_HANDSHAKE  = "__handshake__"

object WireType {
  const val REQUEST     = "REQUEST"
  const val EVENT       = "EVENT"
  const val SYS_EVENT   = "SYS_EVENT"
  const val EPH_EVENT   = "EPH_EVENT"
  const val EVENT_RESP  = "EVENT_RESP"
  const val REQ_RESP    = "REQ_RESP"
}

object SysEvent {
  const val WS_PROVIDER_CONFIG      = "WS_PROVIDER_CONFIG"
  const val ERROR                   = "ERROR"
  const val PING                    = "PING"
}

object Encoder  {
  const val MIN_SIZE_TO_COMPRESS = 500
}

@Suppress("unused")
object DataLeader {

  const val BINARY       = 0x01
  const val DEF_JSON     = 0x02
  const val JSON         = 0x03
  const val ENC_BINARY   = 0x04
  const val ENC_DEF_JSON = 0x05
  const val ENC_JSON     = 0x06
}

@Suppress("unused")
object XmnError {

  const val errorCode           = 555

  const val NetworkNotPresent   = "NetworkNotPresent"  // Network is absent
  const val ConnectionFailed    = "ConnectionFailed"   // server connect problem= server not running, no network, connection break
  const val RequestTimedOut     = "RequestTimedOut"    // ideally means api bug
  const val SendTimedOut        = "SendTimedOut"       // ideally means terribly slow connection
  const val UnAuthorized        = "UnAuthorized"       // When the client id is not valid (server to server)

  const val _ConnectionExpired  = "_ConnectionExpired"
  const val _NotReady           = "_NotReady"
}

open class WireObject(val type: String, val name: String, var data: Any,
                      open var ts: Long = System.currentTimeMillis() * 1000): JsonSerializable {

  companion object {

    fun getWireObject(json: JSONObject): Any? {

      val type          = json.getString("type")
      val name          = json.getString("name")
      val data          = json.get("data")
      val ts            = json.getLong("ts")
      val errorCode     = json.optString("errorCode", "")
      val errorMessage  = json.optString("errorMessage", "")

      return when (type) {

        WireType.REQUEST    -> WireRequest(name, data, ts)
        WireType.SYS_EVENT  -> WireSysEvent(name, data)
        WireType.REQ_RESP   -> WireReqResp(name, data, ts, errorCode, errorMessage)
        WireType.EPH_EVENT  -> WireEphEvent(name, data, ts)
        WireType.EVENT      -> WireEvent(name, data, ts)
        WireType.EVENT_RESP -> WireEventResp(name, data, ts, errorCode, errorMessage)
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

class WireReqResp(name: String, data: Any, ts: Long, val errorCode: String? = null, val errorMessage: String? = null) :
    WireObject(WireType.REQ_RESP, name, data, ts), JsonSerializable {

  override fun toJsonObject(): JSONObject {

    val json = super.toJsonObject()
    if (!errorCode.isNullOrBlank()) json.put("errorCode", errorCode)
    if (!errorMessage.isNullOrBlank()) json.put("errorMessage", errorMessage)
    return json
  }
}

class WireEventResp(name: String, data: Any?, ts: Long, val errorCode: String? = null,val errorMessage: String? = null):
    WireObject(WireType.EVENT_RESP, name, data?:JSONObject(), ts), JsonSerializable {

  override fun toJsonObject(): JSONObject {

    val json = super.toJsonObject()
    if (!errorCode.isNullOrBlank()) json.put("errorCode", errorCode)
    if (!errorMessage.isNullOrBlank()) json.put("errorMessage", errorMessage)
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

data class WsProviderConfig(var pingSecs: Int, var maxOpenSecs: Int, var toleranceSecs: Int,
                            var key: String?, var custom: CustomData?): JsonSerializable {

  constructor(json: JSONObject) : this(json.optInt("pingSecs"), json.optInt("maxOpenSecs"),
                                       json.optInt("toleranceSecs"), json.optString("key"),
                                       if (json.optJSONObject("custom") != null) CustomData.fromJsonObject(json.optJSONObject("custom")) else null)

  override fun toJsonObject(): JSONObject {

    val obj = JSONObject()
    obj.put("pingSecs", pingSecs)
    obj.put("maxOpenSecs", maxOpenSecs)
    obj.put("toleranceSecs", toleranceSecs)
    obj.put("key", key)
    obj.put("custom", custom?.toJsonObject())

    return obj
  }
}

@Suppress("unused")
class ConnectionError(data: Any) {
  val json  : JSONObject  = data as JSONObject
  val code  : String      = json.optString("code", "")
  val msg   : String      = json.optString("msg", "")
}

class RouterResponse(val errorCode: String?, val errorMessage: String?, val data: Any? = null): JsonSerializable {

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
    json.put("errorMessage", errorMessage)
    json.put("data", data)
    json.put("events", eventsArr)

    return json
  }
}

interface XmnProvider {
  fun send(data: Array<WireObject>): String?
}
