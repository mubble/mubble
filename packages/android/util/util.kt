/*------------------------------------------------------------------------------
   About      : Various utility functions

   Created on : 23/11/17
   Author     : Raghvendra Varma

   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

package `in`.mubble.android.util

import `in`.mubble.android.core.App
import android.os.Looper
import org.jetbrains.anko.runOnUiThread
import org.json.JSONObject


/*------------------------------------------------------------------------------

  J S O N    U T I L I T I E S

------------------------------------------------------------------------------*/
fun <T> JSONObject.toImmutableMap(cb: (key: String, jsonObject: JSONObject)->T): Map<String, T> {

  val map     = mutableMapOf<String, T>()
  val allKeys = keys()

  for (key in allKeys) {
    val obj = getJSONObject(key)
    map.put(key, cb(key, obj))
  }

  return map
}

fun <T> JSONObject.toImmutableList(cb: (key: String, jsonObject: JSONObject)->T): List<T> {

  val allKeys = keys()
  val list    = mutableListOf<T>()

  for (key in allKeys) {
    val obj = getJSONObject(key)
    list.add(cb(key, obj))
  }

  return list
}

/*------------------------------------------------------------------------------

  M U L T I    T H R E A D I N G I N G

------------------------------------------------------------------------------*/
fun <T> executeInMainThread( closure: ()->T ): T {

  if (Looper.myLooper() === Looper.getMainLooper()) return closure()

  var resp: T? = null
  val lock = java.lang.Object()

  App.instance.runOnUiThread {
    synchronized(lock) {
      resp = closure()
      lock.notify()
    }
  }

  synchronized(lock) {
    lock.wait()
    return resp!!
  }
}