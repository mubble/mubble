package storage

import android.content.Context
import android.content.SharedPreferences
import core.BaseApp
import core.MubbleLogger
import org.json.JSONArray

abstract class ConfigKeyValue : MubbleLogger {

  private val sharedPrefs = BaseApp.instance.getSharedPreferences("gc-config-key-value", Context.MODE_PRIVATE)
  private val editor : SharedPreferences.Editor = sharedPrefs.edit()

  fun setConfig(config: String) {

    val obj = JSONArray(config)

    for (i in 0 until obj.length()) {

      val entry     = obj.getJSONObject(i)
      val uniqueKey = generateKey(entry.getString("category"), entry.getString("key"))
      val gcValue   = entry.getJSONObject("value")

      editor.putString(uniqueKey, gcValue.toString())
    }
    editor.apply()
  }

  fun setConfig(category: String, key: String, value: String) {

    val uniqueKey = generateKey(category, key)
    editor.putString(uniqueKey, value).apply()
  }

  fun getConfig(category: String, key: String): String? {

    val uniqueKey = generateKey(category, key)
    return sharedPrefs.getString(uniqueKey, null)
  }

  /**
   * Unique key for a GC value object is its category|key
   */
  private fun generateKey(category: String, key: String): String {
    return "$category|$key"
  }
}