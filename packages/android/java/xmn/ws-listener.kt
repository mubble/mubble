package xmn

interface WsListener {
  fun onOpen()
  fun onMessage(message: String?)
  fun onMessage(bytes: ByteArray?)
  fun onError(ex: Exception?)
  fun onCloseInitiated(code: Int?, reason: String?)
  fun onClosing(code: Int?, reason: String?, remote: Boolean?)
  fun onClose(code: Int?, reason: String?)
}