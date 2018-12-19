package upgrade

import core.BaseApp
import core.MubbleLogger
import org.json.JSONObject
import util.AndroidBase
import xmn.*

class UpgradeRouter(serverUrl: String, appShortName: String, jsVersion: String): XmnRouterAndroid(serverUrl,
                                      ConnectionInfo(appShortName, jsVersion)), MubbleLogger {

  override fun handleEphEvent(wo: WireObject) {

  }

  override fun upgradeClientIdentity(wo: WireObject) {
    throw Error("Method not implemented.")
  }

  override fun getNetworkType(): String {
    return AndroidBase.getCurrentNetworkType(BaseApp.instance)
  }

  override fun getLocation(): String {
    return AndroidBase.getCurrentLocation(BaseApp.instance).toString()
  }

  override fun onSocketAbnormalClose(code: Int) {
  }

  override fun getClientIdentity(): ClientIdentity? {
    return null
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