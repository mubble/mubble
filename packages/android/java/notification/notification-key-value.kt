package notification

import android.os.Looper
import org.json.JSONObject
import storage.SharedPreferenceBase
import util.toImmutableMap

/*------------------------------------------------------------------------------
   About      : Key-Value store for Notifications
   
   Created on : 30/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
object NotificationKeyValue : SharedPreferenceBase("notification-key-value") {

  var maxNotifications         : Int by bindPreference()

  // keep them private so that all access to json stuff is controlled via api
  private var serializedNotifications : String by bindPreference()
  private val notificationMap         : JSONObject by lazy {
    JSONObject(serializedNotifications)
  }
  private var nextId: Int = 0

  init {
    check(Looper.myLooper() === Looper.getMainLooper())

    // Here are the properties stored with default values
    maxNotifications = 4 /* Default */
    serializedNotifications = "{}"

    commitDefaults()
  }

  /*
  As we are storing notification list as json, we cannot expose this data structure to the outside
  world (edit outside needs to take care of concurrency as well as hard to maintain
  upgrade code on data structure changes)

  This model will be true for all the the collection kind of data structures

  We will always write the direct api
   */
  fun createOrReplace(msgId: String, dismissOnOpen: Boolean, nxId: Int? = null): Int {

    val notificationId = if (nxId === null) {
      if (nextId == 0) nextId = getMaxId()
      ++nextId
    } else nxId

    val nx = PersistedNotification(msgId, notificationId,
        dismissOnOpen, System.currentTimeMillis())

    notificationMap.put(nx.notificationId.toString(), nx.toJsonObject())
    serializedNotifications = notificationMap.toString()
    return notificationId
  }

  fun getAllSavedNotifications(): Map<String, PersistedNotification> {
    return notificationMap.toImmutableMap {
      _, jsonObject ->
      PersistedNotification(jsonObject)
    }
  }

  private fun getMaxId(): Int {
    val keys = notificationMap.keys()
    var maxId = 0
    for (key in keys) {
      val thisId = key.toInt()
      if (thisId > maxId) maxId = thisId
    }
    return maxId
  }
}

data class PersistedNotification(
  val msgId           : String,
  val notificationId  : Int,
  val dismissOnOpen   : Boolean,
  val timeStamp       : Long
  ) {

  companion object {
    private const val MSG_ID          = "msgId"
    private const val NOTIFICATION_ID = "notificationId"
    private const val DISMISS_ON_OPEN = "dismissOnOpen"
    private const val TIME_STAMP      = "timeStamp"
  }

  constructor(jsonObject: JSONObject) : this(
  jsonObject.getString(MSG_ID),
  jsonObject.getInt(NOTIFICATION_ID),
  jsonObject.getBoolean(DISMISS_ON_OPEN),
  jsonObject.getLong(TIME_STAMP)
  )

  fun toJsonObject(): JSONObject {
    val notification = JSONObject()
    //notification.put(notification.PersistedNotification.Companion.MSG_ID,          msgId)
    //notification.put(notification.PersistedNotification.Companion.NOTIFICATION_ID, notificationId)
    //notification.put(notification.PersistedNotification.Companion.DISMISS_ON_OPEN, dismissOnOpen)
    //notification.put(notification.PersistedNotification.Companion.TIME_STAMP,      timeStamp)
    return notification
  }


}