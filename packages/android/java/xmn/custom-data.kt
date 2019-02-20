package xmn

import core.JsonSerializable
import org.json.JSONObject

data class CustomData(val appName: String, val channel: String,
                      val appVersion: String): JsonSerializable {

  companion object {

    fun fromJsonObject(obj: JSONObject): CustomData {

      val appName     = obj.getString("appName")
      val channel     = obj.getString("channel")
      val appVersion  = obj.getString("appVersion")

      val customData = CustomData(appName, channel, appVersion)

      customData.jsVersion      = obj.optString("jsVersion")
      customData.clientId       = obj.optLong("clientId")
      customData.userLinkId     = obj.optString("userLinkId")
      customData.uniqueId       = obj.optString("uniqueId")
      customData.firstName      = obj.optString("firstName")
      customData.lastName       = obj.optString("lastName")
      customData.profilePicMd5  = obj.optString("profilePicMd5")
      customData.settingsMd5    = obj.optString("settingsMd5")
      customData.migMobileNo    = obj.optString("migMobileNo")
      customData.location       = obj.optString("location")
      customData.networkType    = obj.optString("networkType")

      return customData
    }
  }

  var jsVersion       : String?     = null

  // only available when client is issued an identity
  var clientId        : Long?       = null
  var userLinkId      : String?     = null
  var uniqueId        : String?     = null

  var firstName       : String?     = null
  var lastName        : String?     = null

  var profilePicMd5   : String?     = null
  var settingsMd5     : String?     = null
  var migMobileNo     : String?     = null

  var location        : String?     = null // Serialized JSONObject
  var networkType     : String?     = null

  override fun toJsonObject(): JSONObject {

    val obj = JSONObject()

    obj.put("appName",        appName)
    obj.put("channel",        channel)
    obj.put("appVersion",     appVersion)
    obj.put("jsVersion",      jsVersion)
    obj.put("clientId",       clientId)
    obj.put("userLinkId",     userLinkId)
    obj.put("uniqueId",       uniqueId)
    obj.put("firstName",      firstName)
    obj.put("lastName",       lastName)
    obj.put("profilePicMd5",  profilePicMd5)
    obj.put("settingsMd5",    settingsMd5)
    obj.put("migMobileNo",    migMobileNo)
    obj.put("location",       location)
    obj.put("networkType",    networkType)

    return obj
  }

}