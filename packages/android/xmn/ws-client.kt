package xmn

import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.lang.Exception
import java.net.URI
import java.nio.ByteBuffer

/**
 * Created by
 * siddharthgarg on 11/04/18.
 */

class WsClient(serverURI: URI, private val wsListener: WsListener) : WebSocketClient(serverURI) {

  override fun onOpen(handshakeData: ServerHandshake?) {
    wsListener.onOpen()
  }

  override fun onMessage(message: String?) {
    wsListener.onMessage(message)
  }

  override fun onMessage(bytes: ByteBuffer?) {
    wsListener.onMessage(bytes)
  }

  override fun onError(ex: Exception?) {
    wsListener.onError(ex)
  }

  override fun onCloseInitiated(code: Int, reason: String?) {
    wsListener.onCloseInitiated(code, reason)
  }

  override fun onClosing(code: Int, reason: String?, remote: Boolean) {
    wsListener.onClosing(code, reason, remote)
  }

  override fun onClose(code: Int, reason: String?, remote: Boolean) {
    wsListener.onClose(code, reason)
  }
}

interface WsListener {
  fun onOpen()
  fun onMessage(message: String?)
  fun onMessage(bytes: ByteBuffer?)
  fun onError(ex: Exception?)
  fun onCloseInitiated(code: Int, reason: String?)
  fun onClosing(code: Int, reason: String?, remote: Boolean)
  fun onClose(code: Int, reason: String?)
}