package xmn

import java.net.URI

/**
 * Created by
 * siddharthgarg on 11/04/18.
 */

class WsClient(serverURI: URI, wsListener: WsListener) : OkHttpWsClient(serverURI, wsListener)

interface AndroidWsClient {

  fun connect()
  fun close()
  fun send(data: ByteArray?)
  fun hasBufferedData(): Boolean
  fun readyStateName(): String
  fun checkStateReady(): Boolean
}
