package storage

import android.content.Context
import android.content.SharedPreferences
import core.BaseApp
import core.MubbleLogger
import org.json.JSONArray
import org.json.JSONObject

/**
 * Created by
 * siddharthgarg on 12/04/18.
 *
 * This is equivalent to user-key-val localStorage of JS.
 * All values are String.
 *
 */

abstract class UserKeyValue: MubbleLogger {

  private val sharedPrefs : SharedPreferences         = BaseApp.instance.getSharedPreferences("user-key-value", Context.MODE_PRIVATE)
  private val editor      : SharedPreferences.Editor  = sharedPrefs.edit()

  companion object {

    private const val LAST_USER = "lastUser"
    private const val USERS     = "users"
  }

  override val customTag: String
    get() = "UserKeyValue"

  fun save() {
    editor.apply()
  }

  /* --------------------------------------------------------------------------

    GETTERS/SETTERS

   ------------------------------------------------------------------------- */

  fun setLastLoginClientId(clientId: Long, autoSave: Boolean = true) {

    editor.putString(LAST_USER, clientId.toString())
    if (autoSave) editor.apply()
  }

  fun getLastLoginClientId(): Long? {
    return sharedPrefs.getString(LAST_USER, null)?.toLong()
  }

  fun isMultiUser(): Boolean {
    val users = JSONObject(sharedPrefs.getString(USERS, "{}"))
    return users.length() > 1
  }

  fun getAllClientIds(): JSONArray {

    val users = JSONObject(sharedPrefs.getString(USERS, "{}"))

    val arr = JSONArray()

    users.keys().forEach {
      arr.put(it.toLong())
    }

    return arr
  }

  protected fun getUsers(): JSONObject {

    return JSONObject(sharedPrefs.getString(USERS, "{}"))
  }

  fun setValue(key: String, value: String?) {
    editor.putString(key, value).apply()
  }

  fun getValue(key: String): String? {
    return sharedPrefs.getString(key, null)
  }

  fun clear() {

    editor.remove(LAST_USER)
    editor.remove(USERS)
    editor.apply()
  }

}
