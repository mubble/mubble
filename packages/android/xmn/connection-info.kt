package `in`.mubble.android.xmn

enum class Protocol {HTTP, WEBSOCKET, HTTPS}

data class ConnectionInfo(
  val shortName : String,
  val uniqueId  : String,
  val protocol  : Protocol,
  val host      : String = "",   // host name of the server
  val port      : Int    = 80    // port of the server
  ) {

  var url             : String = ""   // /api/getTopics Or connectUrl (for WS)
  var headers         : Unit?  = null // empty for client
  var ip              : String = ""   // ip address or host name of the client socket

  // Information passed by the client: to be used by Xmn internally
  var publicRequest   : Boolean = false

  // Server fields. Not used by client
  var msOffset        : Long = 0      // this is inferred by the server based on client's now field. Api/event need not use this
  var lastEventTs     : Long = 0      // Must be set before an event is processed on server

  // Information passed by the client used by
  var location        : String = ""   // it is in form of serialized json object
  var networkType     : String = ""
  // var clientIdentity  : ClientIdentity

  // provider for this connection (WebSocket, Http etc.)
  // var provider        : any       // The protocol provider keeps it's custom data here

  var syncKey         : ByteArray = ByteArray(32)
}