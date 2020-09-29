package upgrade

import ConstBase
import core.BaseApp
import core.MubbleLogger
import firebase.FirebaseAnalytics
import org.jetbrains.anko.info
import org.json.JSONObject
import util.syncExecuteInMainThread
import xmn.RouterResponse

class UpgradeClient(private val listener: JSUpgradeEvents, serverUrl: String,
                    appShortName: String, jsVersion: String): MubbleLogger {

  private var versionName       : String?           = null
  private var manifestData      : ManifestStruct?   = null

  private var lastDownloadIdx   : Int               = 0
  private var lastCopyIdx       : Int               = 0
  private var upgradeRouter     : UpgradeRouter = UpgradeRouter(serverUrl, appShortName, jsVersion)

  override val customTag: String
    get() = "UpgradeClient"

  companion object {

    // These chunk sizes to be finalized by benchmarking
    // const val CHUNK_SIZE_2G  = 1000L
    // const val CHUNK_SIZE_3G  = 10000L
    // const val CHUNK_SIZE_4G  = 100000L
    const val CHUNK_SIZE_DEF = 50000L
  }

  fun cleanupRouter() {
    upgradeRouter.cleanup()
  }

  fun checkUpgradeVersion(cb: (Boolean) -> Unit) {

    val storedManifest = UpgradeUtil.readManifestFromUpgrade(BaseApp.instance)
    if (storedManifest == null) {
      cb(false)
      return
    }

    val storedManifestData = ManifestStruct.fromJsonObject(JSONObject(storedManifest))
    if (storedManifestData.success) {
      cb(false)
      return
    }

    val fromVersion = syncExecuteInMainThread { BaseApp.instance.globalKeyVal.getJsVersion() }!!

    upgradeRouter.checkUpgradeVersion(fromVersion, storedManifestData.versionName) {
      runUpgrade(cb, it)
    }
  }

  private fun beforeUpgradeStart() {

    val lastRunTs = syncExecuteInMainThread { BaseApp.instance.globalKeyVal.getLastUpgradeRunTs() }!!

    if (lastRunTs > 0 && System.currentTimeMillis() - lastRunTs > ConstBase.Time.MILL_IN_DAY) {
      FirebaseAnalytics.logEvent(BaseApp.instance, ConstBase.Firebase.UPGRADE_PING, JSONObject())
    }

    syncExecuteInMainThread { BaseApp.instance.globalKeyVal.setLastUpgradeRunTs() }

    listener.onJSUpgradeStarted()
  }

  fun onUpgradeEvent(manifest: ManifestStruct) {

    beforeUpgradeStart()
    manifestData = manifest
    versionName  = manifestData!!.versionName

    val storedManifest = UpgradeUtil.readManifestFromUpgrade(BaseApp.instance)

    if (storedManifest == null) {
      manifestData!!.success = false
      UpgradeUtil.writeManifestToUpgrade(BaseApp.instance, manifestData.toString())

    } else {
      val storedManifestData: ManifestStruct = ManifestStruct.fromJsonObject(JSONObject(storedManifest))

      if (storedManifestData.versionName == versionName) {
        if (storedManifestData.success || storedManifestData.corrupt) {
          info { "StoredManifest success: ${storedManifestData.success}, corrupt: ${storedManifestData.corrupt}" }
          finishUpgrade()
          return
        }
        manifestData = storedManifestData

      } else {
        UpgradeUtil.deleteUpgradeFolder(BaseApp.instance)
        manifestData!!.success = false
        UpgradeUtil.writeManifestToUpgrade(BaseApp.instance, manifestData.toString())
      }
    }

    downloadFiles()
  }

  private fun runUpgrade(cb: (Boolean) -> Unit, resp: RouterResponse) {

    if (!resp.errorCode.isNullOrBlank()) {
      cleanupRouter()
      cb(false)
      return
    }

    val data      = resp.data as JSONObject
    val toVersion = data.optString(CheckUpgradeVersion.RetVal.toVersion)

    if (toVersion.isNullOrBlank()) {
      cleanupRouter()
      cb(false)
      return
    }

    cb(true)

    val storedManifest      = UpgradeUtil.readManifestFromUpgrade(BaseApp.instance)!!
    val storedManifestData  = ManifestStruct.fromJsonObject(JSONObject(storedManifest))
    val toVersionManifest   = storedManifestData.versionName

    if (toVersionManifest == toVersion) {
      if (storedManifestData.corrupt) return
      beforeUpgradeStart()
      manifestData = storedManifestData
      versionName  = manifestData!!.versionName
      downloadFiles()

    } else {
      val manifest = data.optJSONObject(CheckUpgradeVersion.RetVal.manifest)
      onUpgradeEvent(ManifestStruct.fromJsonObject(manifest!!))
    }
  }

  private fun downloadFiles() {

    val files = manifestData!!.files

    while (lastDownloadIdx < files.size) {

      val file = files[lastDownloadIdx++]
      if (!file.download || file.done) continue
      info { "Downloading file: ${file.name}" }
      callApi(file, false)
      break
    }

    if (lastDownloadIdx == files.size) {
      copyFiles()
    }
  }

  private fun copyFiles() {

    val files = manifestData!!.files

    while (lastCopyIdx < files.size) {

      val file = files[lastCopyIdx++]
      if (!file.copy || file.done) continue
      info { "Copying file ${file.name}" }
      if (copyFile(file)) break
    }

    if (lastCopyIdx == files.size) {
      manifestData!!.success = true
      UpgradeUtil.writeManifestToUpgrade(BaseApp.instance, manifestData.toString())
      info { "Copy files finished" }
      finishUpgrade()
    }
  }

  private fun finishUpgrade() {

    listener.onJSUpgradeEnded()
    cleanupRouter()
  }

  private fun callApi(file: ManifestFileStruct, copy: Boolean) {

    val fileNameToServer        = versionName + '/' + file.name
    var filePath                = ""
    var fileName: String        = file.name
    val splitted: List<String>  = fileName.split('/')

    if (splitted.size > 1) {

      splitted.forEach {
        filePath = "$filePath/$it"
      }

      fileName = splitted[splitted.size - 1]
    }

    // todo: chunk size will depend on network type
    val chunk           = CHUNK_SIZE_DEF
    val downloadedBytes = file.downloadedBytes ?: 0
    val chunkSizeCall: Long = if ((file.size - downloadedBytes) < chunk) (file.size - downloadedBytes) else chunk

    if (file.type == "binary") {
      upgradeRouter.downloadFile(fileNameToServer, file.type,
          downloadedBytes, downloadedBytes + chunkSizeCall - 1) {

        if (it == null) {
          finishUpgrade()
          error { "Did not get any file" }
        } else {
          onFileChunkDownloaded(downloadedBytes, chunkSizeCall, file,
              it as ByteArray, filePath, fileName, copy)
        }
      }

    } else {
      upgradeRouter.downloadFile(fileNameToServer, file.type,
          downloadedBytes,downloadedBytes + chunkSizeCall - 1) {

        if (it == null) {
          finishUpgrade()
          error { "Did not get any file" }
        } else {
          onFileChunkDownloaded(downloadedBytes, chunkSizeCall, file,
              it as String, filePath, fileName, copy)
        }
      }
    }

  }

  private fun onFileChunkDownloaded(downloadedBytes: Long, chunkSizeCall: Long,
                                    file: ManifestFileStruct, str: String,
                                    filePath: String, fileName: String, copy: Boolean) {

    val success: Boolean = if (downloadedBytes == 0L) {
      UpgradeUtil.writeToTextFileInUpgrade(BaseApp.instance, filePath, fileName, str)
    } else {
      UpgradeUtil.appendToTextFileInUpgrade(BaseApp.instance, filePath, fileName, str)
    }

    postProcessFileChunkDownload(downloadedBytes, chunkSizeCall, file, filePath,
                                 fileName, copy, success)
  }

  private fun onFileChunkDownloaded(downloadedBytes: Long, chunkSizeCall: Long,
                                    file: ManifestFileStruct, byteArray: ByteArray,
                                    filePath: String, fileName: String, copy: Boolean) {

    val success: Boolean = if (downloadedBytes == 0L) {
      UpgradeUtil.writeToBinaryFileInUpgrade(BaseApp.instance, filePath, fileName, byteArray)
    } else {
      UpgradeUtil.appendToBinaryFileInUpgrade(BaseApp.instance, filePath, fileName, byteArray)
    }

    postProcessFileChunkDownload(downloadedBytes, chunkSizeCall, file, filePath,
                                 fileName, copy, success)
  }

  fun postProcessFileChunkDownload(downloadedBytes: Long, chunkSizeCall: Long,
                                   file: ManifestFileStruct, filePath: String,
                                   fileName: String, copy: Boolean, success: Boolean) {

    if (success) {
      file.downloadedBytes = downloadedBytes + chunkSizeCall

      if (file.downloadedBytes == file.size) {
        if (UpgradeUtil.checkMD5(BaseApp.instance, file.checkSum, filePath, fileName)) {
          file.done = true

        } else {
          reportFileCorrupted(filePath, fileName)
          manifestData!!.corrupt = true
          UpgradeUtil.cleanupUpgradeLeavingManifest(BaseApp.instance)
          error { "File got corrupted: $fileName" }
        }
      }

      UpgradeUtil.writeManifestToUpgrade(BaseApp.instance, manifestData.toString())
      if (manifestData!!.corrupt) return
    }

    if (file.downloadedBytes == file.size) {
      if (copy) copyFiles() else downloadFiles()
    } else {
      callApi(file, copy)
    }
  }

  private fun copyFile(file: ManifestFileStruct): Boolean {

    val success: Boolean = UpgradeUtil.copyFileFromCodeToUpgrade(BaseApp.instance, file.name)
    var download = false

    if (success) {
      file.done = true
      UpgradeUtil.writeManifestToUpgrade(BaseApp.instance, manifestData.toString())

    } else {
      // todo: report databug
      download = true
      this.callApi(file, true)
    }
    return download
  }

  private fun reportFileCorrupted(filePath: String, fileName: String) {

    val eventData = JSONObject()
    eventData.put("filePath", filePath)
    eventData.put("fileName", fileName)

    FirebaseAnalytics.logEvent(BaseApp.instance, ConstBase.Firebase.FILE_CORRUPT_UPGRADE, eventData)
  }
}