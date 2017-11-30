/*------------------------------------------------------------------------------
   About      : Various utility functions

   Created on : 23/11/17
   Author     : Raghvendra Varma

   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

package `in`.mubble.android.util

import org.json.JSONObject

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
