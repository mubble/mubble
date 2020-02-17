package storage

import android.content.Context
import android.content.SharedPreferences
import core.BaseApp
import core.MubbleLogger
import org.json.JSONObject
import java.util.*

/*------------------------------------------------------------------------------
   About      : Global preferences. Persist App level (used by multiple modules)
                information here. This is accessible only from main thread
                This is equivalent to user-key-val localStorage of JS.

   Created on : 29/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

abstract class GlobalKeyValue: MubbleLogger {

  private val sharedPrefs = BaseApp.instance.getSharedPreferences("global-key-value", Context.MODE_PRIVATE)
  private val editor : SharedPreferences.Editor = sharedPrefs.edit()

  fun setValue(key: String, value: String?) {
    if (value.isNullOrBlank()) editor.remove(key)
    editor.putString(key, value).apply()
  }

  fun getValue(key: String): String? {
    return sharedPrefs.getString(key, null)
  }

  fun setFcmId(fcmId: String) {
    editor.putString("fcmId", fcmId).apply()
  }

  fun getFcmId(): String? {
    return sharedPrefs.getString("fcmId", null)
  }

  fun setPseudoId(pseudoId: String) {
    editor.putString("pseudoId", pseudoId).apply()
  }

  fun getPseudoId(): String? {
    return sharedPrefs.getString("pseudoId", null)
  }

  fun setAdId(adId: String) {
    editor.putString("adId", adId).apply()
  }

  fun getAdId(): String? {
    return sharedPrefs.getString("adId", null)
  }

  fun getUniqueId(): String {

    var uniqueId = sharedPrefs.getString("uniqueId", null)

    if (uniqueId.isNullOrBlank()) {
      uniqueId = UUID.randomUUID().toString()
      setValue("uniqueId", uniqueId)
    }

    return uniqueId
  }

  open fun getJsVersion(): String? {
    return sharedPrefs.getString("jsVersion", null)
  }

  fun setJsVersion(jsVersion: String) {
    editor.putString("jsVersion", jsVersion).apply()
  }

  fun getEnvConfig(): JSONObject {

    val config = sharedPrefs.getString("envConfig", "{}")!!
    return JSONObject(config)
  }

  fun setLastUpgradeRunTs() {
    editor.putLong("lastUpgradeRunTs", System.currentTimeMillis()).apply()
  }

  fun getLastUpgradeRunTs(): Long {
    return sharedPrefs.getLong("lastUpgradeRunTs", -1)
  }

  fun clear() {

   editor.clear()
   editor.apply()
  }

}

