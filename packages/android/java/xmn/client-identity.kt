package xmn

import core.JsonSerializable
import org.json.JSONObject

/**
 * Created by
 * siddharthgarg on 04/04/18.
 */

data class ClientIdentity(val appName: String, val channel: String,
                          val appVersion: String): JsonSerializable {

  constructor(json: JSONObject)
      : this(json.getString("appName"), json.getString("channel"), json.getString("appVersion"))

  var jsVersion       : String?     = null

  // only available when client is issued an identity
  var clientId        : Long?       = null
  var userLinkId      : String?     = null
  var userName        : String?     = null
  var firstName       : String?     = null
  var lastName        : String?     = null
  var migMobileNo     : String?     = null

  var userRole        : String?     = null
  var profilePicMd5   : String?     = null
  var settingsMd5     : String?     = null

  override fun toJsonObject(): JSONObject {

    val obj = JSONObject()

    obj.put("appName",        appName)
    obj.put("channel",        channel)
    obj.put("appVersion",     appVersion)
    obj.put("jsVersion",      jsVersion)
    obj.put("clientId",       clientId)
    obj.put("migMobileNo",    migMobileNo)
    obj.put("userLinkId",     userLinkId)
    obj.put("userName",       userName)
    obj.put("firstName",      firstName)
    obj.put("lastName",       lastName)
    obj.put("userRole",       userRole)
    obj.put("profilePicMd5",  profilePicMd5)
    obj.put("settingsMd5",    settingsMd5)

    return obj
  }

}
