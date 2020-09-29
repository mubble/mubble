package upgrade

import core.JsonSerializable
import org.json.JSONArray
import org.json.JSONObject

/**
 * ---------------------------------- EVENTS -----------------------------------
 */

object UpgradeJSCodeEvent {

  const val name   = "upgradeJSCodeEvent"
  const val retVal = "manifest"
}

/**
 * ---------------------------------- APIS -------------------------------------
 */

object CheckUpgradeVersion {

  const val name = "checkUpgradeVersion"

  object Params {
    const val fromVersion = "fromVersion"
    const val toVersion   = "toVersion"
  }

  object RetVal {
    const val manifest  = "manifest"
    const val toVersion = "toVersion"
  }
}

object DownloadFile {

  const val name = "downloadFile"

  object Params {
    const val fileName    = "fileName"
    const val fileType    = "fileType"
    const val startIndex  = "startIndex"
    const val endIndex    = "endIndex"
  }
}


/**
 * --------------------------- UPGRADE MANIFEST --------------------------------
 */

class ManifestStruct: JsonSerializable {

  var versionName     : String    = ""
  var success         : Boolean   = false
  var corrupt         : Boolean   = false
  var breakingChange  : Boolean?  = null
  var versionPublic   : Boolean?  = null
  var files           : Array<ManifestFileStruct> = emptyArray()

  companion object {

    fun fromJsonObject(json: JSONObject): ManifestStruct {

      val struct = ManifestStruct()
      struct.versionName    = json.optString("versionName")
      struct.success        = json.optBoolean("success")
      struct.corrupt        = json.optBoolean("corrupt")
      struct.breakingChange = json.optBoolean("breakingChange")
      struct.versionPublic  = json.optBoolean("versionPublic")

      val filesArr = json.optJSONArray("files")
      if (filesArr != null) {
        for (i in 0 until filesArr.length()) {
          val fileStructJson = filesArr[i] as JSONObject
          struct.files = struct.files.plus(ManifestFileStruct.fromJsonObject(fileStructJson))
        }
      }

      return struct
    }
  }

  override fun toJsonObject(): JSONObject {

    val filesArr = JSONArray()

    files.forEach {
      filesArr.put(it.toJsonObject())
    }

    val json = JSONObject()
    json.put("versionName", versionName)
    json.put("success", success)
    json.put("corrupt", corrupt)
    json.put("files", filesArr)
    json.put("breakingChange", breakingChange)
    json.put("versionPublic", versionPublic)

    return json
  }

  override fun toString(): String = toJsonObject().toString()

}

class ManifestFileStruct: JsonSerializable {

  var name             : String = ""
  var size             : Long = 0L
  var checkSum         : String = ""
  var type             : String = ""
  var download         : Boolean = false
  var copy             : Boolean = false
  var done             : Boolean = false
  var downloadedBytes  : Long? = null

  companion object {

    fun fromJsonObject(json: JSONObject): ManifestFileStruct {

      val struct = ManifestFileStruct()

      struct.name             = json.optString("name", "")
      struct.size             = json.optLong("size", 0L)
      struct.checkSum         = json.optString("checkSum", "")
      struct.type             = json.optString("type", "")
      struct.download         = json.optBoolean("download")
      struct.copy             = json.optBoolean("copy")
      struct.done             = json.optBoolean("done")
      struct.downloadedBytes  = json.optLong("downloadedBytes")

      return struct
    }
  }

  override fun toJsonObject(): JSONObject {

    val json = JSONObject()

    json.put("name", name)
    json.put("size", size)
    json.put("checkSum", checkSum)
    json.put("type", type)
    json.put("download", download)
    json.put("copy", copy)
    json.put("done", done)
    json.put("downloadedBytes", downloadedBytes)

    return json
  }

  override fun toString(): String = toJsonObject().toString()
}

