package `in`.mubble.android.xmn

import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.lang.Exception
import java.net.URI

/**
 * Created by raghavv on 14/11/17.
 *
 * https://github.com/TooTallNate/Java-WebSocket/blob/master/src/main/java/org/java_websocket/client/WebSocketClient.java
 *
 */
class WsAndroid(serverUri: URI?) : WebSocketClient(serverUri) {

  override fun onOpen(handshakedata: ServerHandshake?) {
    TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
  }

  override fun onClose(code: Int, reason: String?, remote: Boolean) {
    TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
  }

  override fun onMessage(message: String?) {
    TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
  }

  override fun onError(ex: Exception?) {
    TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
  }

}