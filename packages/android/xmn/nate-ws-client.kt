package xmn

import `in`.mubble.android.util.asyncExecuteInMainThread
import org.java_websocket.WebSocket
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.lang.Exception
import java.net.URI
import java.nio.ByteBuffer

open class NateWsClient(serverURI: URI, private val wsListener: WsListener)
                        : AndroidWsClient, WebSocketClient(serverURI) {

  override fun checkStateReady(): Boolean {
    return readyState === WebSocket.READYSTATE.OPEN
  }

  override fun readyStateName(): String {
    return readyState.name
  }

  override fun onOpen(handshakeData: ServerHandshake?) {
    asyncExecuteInMainThread { wsListener.onOpen() }
  }

  override fun onMessage(message: String?) {
    asyncExecuteInMainThread { wsListener.onMessage(message) }
  }

  override fun onMessage(bytes: ByteBuffer?) {

    if (bytes == null) return

    asyncExecuteInMainThread {

      if (!bytes.hasArray()) {
        error { "Found Readonly data array in buffer" }
      } else {
        wsListener.onMessage(bytes.array())
      }

    }
  }

  override fun onError(ex: Exception?) {
    asyncExecuteInMainThread { wsListener.onError(ex) }
  }

  override fun onCloseInitiated(code: Int, reason: String?) {
    asyncExecuteInMainThread { wsListener.onCloseInitiated(code, reason) }
  }

  override fun onClosing(code: Int, reason: String?, remote: Boolean) {
    asyncExecuteInMainThread { wsListener.onClosing(code, reason, remote) }
  }

  override fun onClose(code: Int, reason: String?, remote: Boolean) {
    asyncExecuteInMainThread { wsListener.onClose(code, reason) }
  }
}