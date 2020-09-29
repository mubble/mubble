package upgrade

import android.util.Base64
import core.BaseApp
import core.MubbleLogger
import org.json.JSONObject
import util.AndroidBase
import xmn.*

class UpgradeRouter(serverUrl: String, appShortName: String, jsVersion: String): XmnRouterAndroid(serverUrl,
                                      ConnectionInfo(appShortName, PROTOCOL_VERSION), PUB_KEY), MubbleLogger {

  companion object {
    private const val PUB_KEY_B64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2k6OqKE66JAb1wZAwpzLe1J6tXnATpQZM5xG6pTgBeUUJA8zj8Klezsf5yqxjsVHA8SpDs9wwLnCcjbrrTEYPL/9H2Srq5gX+XUq0r6aKQzp6JA5/KaE1iyxNY15cVDK9vKPK6Pd/jyyHvyPdNGKTYXoCaDTRH3xn8ULKaP7Q03NMM4FK1eiaUxK71cxFdSYhm3jJT3kUEvR9VEzc0RgCLpejT1IUq2PuE4LDSs57pAQGd7HWlUdlcBLIPfibfla83VO1IzeY1gAZ9goytmfJpfwl3bPb1OtuPWZgMo78K2FRmZ9pfMiyGQb3OShYRzwIiMB73LwimiQVDYUFONJgwIDAQAB"
    private val       PUB_KEY     = Base64.decode(PUB_KEY_B64, Base64.NO_WRAP)
    private const val MAX_OPEN_SECS = 1200
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