package xmn

import core.JsonSerializable
import org.json.JSONObject

data class CustomData(val appName: String, val channel: String,
                      val appVersion: String, val jsVersion: String): JsonSerializable {

  companion object {

    fun fromJsonObject(obj : JSONObject?): CustomData? {

      if (obj == null) return null

      val appName     = obj.getString("appName")
      val channel     = obj.getString("channel")
      val appVersion  = obj.getString("appVersion")
      val jsVersion   = obj.getString("jsVersion")

      val customData = CustomData(appName, channel, appVersion, jsVersion)

      customData.deviceId       = obj.optString("deviceId")
      customData.clientId       = obj.optLong("clientId")

      customData.appUserId      = obj.optString("appUserId")
      customData.sessionId      = obj.optString("sessionId")

      //customData.userLinkId     = obj.optString("userLinkId")
      //customData.uniqueId       = obj.optString("uniqueId")
      //customData.migMobileNo    = obj.optString("migMobileNo")

      customData.firstName      = obj.optString("firstName")
      customData.lastName       = obj.optString("lastName")
      customData.profilePicMd5  = obj.optString("profilePicMd5")
      customData.settingsMd5    = obj.optString("settingsMd5")
      customData.location       = obj.optString("location")
      customData.networkType    = obj.optString("networkType")

      return customData
    }
  }

  var deviceId        : String?     = null

  // only available when client is issued an identity
  var clientId        : Long?       = null

  var appUserId       : String?     = null
  var sessionId       : String?     = null

  //var userLinkId      : String?     = null
  //var uniqueId        : String?     = null

  var firstName       : String?     = null
  var lastName        : String?     = null

  var profilePicMd5   : String?     = null
  var settingsMd5     : String?     = null
  //var migMobileNo     : String?     = null

  var location        : String?     = null // Serialized JSONObject
  var networkType     : String?     = null

  override fun toJsonObject(): JSONObject {

    val obj = JSONObject()

    obj.put("appName",        appName)
    obj.put("channel",        channel)
    obj.put("deviceId",       deviceId)
    obj.put("appVersion",     appVersion)
    obj.put("jsVersion",      jsVersion)

    obj.put("clientId",       clientId)
    obj.put("appUserId",      appUserId)
    obj.put("sessionId",      sessionId)

    //obj.put("userLinkId",     userLinkId)
    //obj.put("uniqueId",       uniqueId)

    obj.put("firstName",      firstName)
    obj.put("lastName",       lastName)
    obj.put("profilePicMd5",  profilePicMd5)
    obj.put("settingsMd5",    settingsMd5)
    //obj.put("migMobileNo",    migMobileNo)
    obj.put("location",       location)
    obj.put("networkType",    networkType)

    return obj
  }

}