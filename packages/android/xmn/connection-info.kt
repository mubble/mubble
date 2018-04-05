package `in`.mubble.android.xmn

import xmn.ClientIdentity

enum class Protocol {HTTP, WEBSOCKET, HTTPS}

open class ConnectionInfo(val shortName: String, val uniqueId: String) {

  // Connection attributes
  var protocol            : Protocol        = Protocol.WEBSOCKET
  var host                : String          = ""        // host name of the server
  var port                : Int             = 80        // port of the server
  var url                 : String          = ""        // /api/getTopics Or connectUrl (for WS)

  // Information passed by the client: to be used by Xmn internally
  var publicRequest       : Boolean         = false
  var useEncryption       : Boolean         = false

  // Information passed by the client used by
  var location            : String          = ""        // it is in form of serialized json object
  var networkType         : String          = ""
  var clientIdentity      : ClientIdentity? = null

  // provider for this connection (WebSocket, Http etc.)
  var provider            : WsAndroid?      = null      // The protocol provider keeps it's custom data here
  var syncKey             : ByteArray       = ByteArray(32)
}