package xmn

import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.android.util.asyncExecuteInMainThread
import okhttp3.*
import okio.ByteString
import org.jetbrains.anko.warn
import java.net.URI
import java.nio.ByteBuffer

open class OkHttpWsClient(private val serverURI: URI, private val wsListener: WsListener)
                          : AndroidWsClient, WebSocketListener(), MubbleLogger {

  private val client    : OkHttpClient = OkHttpClient()
  private var webSocket : WebSocket?   = null

  override fun connect() {

    val request = Request.Builder().url(serverURI.toURL()).build()
    webSocket   = client.newWebSocket(request, this)
    client.dispatcher().executorService().shutdown()
  }

  override fun close() {
    webSocket?.close(1000, null)
  }

  override fun send(data: ByteArray?) {

    if (data == null || data.isEmpty()) {
      warn { "Empty Request" }
      return
    }

    webSocket?.send(ByteString.of(ByteBuffer.wrap(data)))
  }

  override fun hasBufferedData(): Boolean {

    val queueSize = webSocket?.queueSize()
    return queueSize != null && queueSize > 0
  }

  override fun readyStateName(): String {
    return "NOT_SPECIFIED" // TODO:
  }

  override fun checkStateReady(): Boolean {
    return true // TODO:
  }

  override fun onOpen(webSocket: WebSocket?, response: Response?) {
    asyncExecuteInMainThread { wsListener.onOpen() }
  }

  override fun onMessage(webSocket: WebSocket?, bytes: ByteString?) {

    if (bytes == null) return
    asyncExecuteInMainThread { wsListener.onMessage(bytes.toByteArray()) }
  }

  override fun onMessage(webSocket: WebSocket?, text: String?) {
    asyncExecuteInMainThread { wsListener.onMessage(text) }
  }

  override fun onClosing(webSocket: WebSocket?, code: Int, reason: String?) {

    asyncExecuteInMainThread { wsListener.onClosing(code, reason, null) }
    webSocket?.close(1000, null)
  }

  override fun onClosed(webSocket: WebSocket?, code: Int, reason: String?) {
    asyncExecuteInMainThread { wsListener.onClose(code, reason) }
  }

  override fun onFailure(webSocket: WebSocket?, t: Throwable?, response: Response?) {

    asyncExecuteInMainThread {

      if (t != null) {
        try {
          throw t
        } catch (e: Exception) {
          wsListener.onError(e)
        }
      }
    }
  }

}