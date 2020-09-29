package xmn

enum class Protocol {HTTP, WEBSOCKET, HTTPS}

open class ConnectionInfo(val shortName: String, val protocolVersion     : String) {

  // Connection attributes
  var protocol            : Protocol = Protocol.WEBSOCKET
  var host                : String          = ""        // host name of the server
  var port                : Int             = 80        // port of the server
  var url                 : String          = ""        // /api/getTopics Or connectUrl (for WS)

  var publicRequest       : Boolean         = false
  var customData          : CustomData?     = null

    // provider for this connection (WebSocket, Http etc.)
  var provider            : WsAndroid? = null
}