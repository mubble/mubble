package xmn

open class SessionInfo(val protocolVersion: String) {

  // provider for this connection (WebSocket, Http etc.)
  var provider : WsAndroid? = null
}