package upgrade

import android.util.Base64
import com.obopay.dms.deliverypartner.BuildConfig
import core.BaseApp
import core.MubbleLogger
import org.json.JSONObject
import util.AndroidBase
import xmn.*
import javax.crypto.spec.IvParameterSpec

class UpgradeRouter(serverUrl: String, appShortName: String, jsVersion: String): XmnRouterAndroid(serverUrl,
                                      ConnectionInfo(appShortName, PROTOCOL_VERSION), PUB_KEY, IV_SPEC), MubbleLogger {

  companion object {
    private const val PUB_KEY_B64           = BuildConfig.PUB_KEY
    private val PUB_KEY                     = Base64.decode(PUB_KEY_B64, Base64.NO_WRAP)
    private const val MAX_OPEN_SECS         = 1200
    private       val IV_SPEC               = IvParameterSpec(byteArrayOf(0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                                                          0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00))
  }

  override fun handleEphEvent(wo: WireObject) {

  }

  override fun getNetworkType(): String {
    return AndroidBase.getCurrentNetworkType(BaseApp.instance)
  }

  override fun getLocation(): String {
    return AndroidBase.getCurrentLocation(BaseApp.instance).toString()
  }

  override fun getMaxOpenSecs(): Int {
    return MAX_OPEN_SECS
  }

  override fun onSocketAbnormalClose(code: Int) {
  }

  override fun getCustomData(): CustomData? {
    return null
  }

  override fun runAlwaysAsSecure(): Boolean {
    return true
  }

  override fun updateCustomDataFromConfig(wo: WireObject) {

  }

  fun checkUpgradeVersion(fromVersion: String, toVersion: String, cb:(RouterResponse) -> Unit) {

    val params = JSONObject()
    params.put(CheckUpgradeVersion.Params.fromVersion, fromVersion)
    params.put(CheckUpgradeVersion.Params.toVersion,   toVersion)

    sendRequest(CheckUpgradeVersion.name, params, {
      cb(it)
    })
  }

  fun downloadFile(fileName: String, fileType: String, startIndex: Long,
                   endIndex: Long, cb: (Any?) -> Unit) {

    val params = JSONObject()
    params.put(DownloadFile.Params.fileName, fileName)
    params.put(DownloadFile.Params.fileType, fileType)
    params.put(DownloadFile.Params.startIndex, startIndex)
    params.put(DownloadFile.Params.endIndex, endIndex)

    sendRequest(DownloadFile.name, params, {
      cb(it.data)
    })
  }

}