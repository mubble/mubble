package notification

import android.app.NotificationManager
import android.content.Context
import core.BaseApp
import core.MubbleLogger

/*------------------------------------------------------------------------------
   About      : Notification Center
   
   Created on : 30/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

class NotificationCenter: MubbleLogger {

  fun onNotification(title: String, msg: String,
                     iconName: String, iconBase64: String,
                     messageId: String, messageType: String,
                     dismissOnOpen: Boolean, replace: Boolean,
                     payload: String, badgeCount: Int) {


    val notificationManager = BaseApp.instance.getSystemService(
                                Context.NOTIFICATION_SERVICE) as NotificationManager

    val notiId = saveNotification(messageId, replace, dismissOnOpen)


  }






  private fun saveNotification(msgId: String, replace: Boolean,
                               dismissOnOpen: Boolean): Int {

    val map     = NotificationKeyValue.getAllSavedNotifications()
    val values  = map.values
    var oldest   : PersistedNotification? = null
    var minTS    : Long = Long.MAX_VALUE

    for (nx in values) {

      if (replace && nx.msgId === msgId) return NotificationKeyValue.createOrReplace(
          nx.msgId, dismissOnOpen, nx.notificationId)

      if (minTS > nx.timeStamp) {
        minTS   = nx.timeStamp
        oldest  = nx
      }
    }

    if (map.size >= NotificationKeyValue.maxNotifications) return NotificationKeyValue.createOrReplace(
        msgId, dismissOnOpen, oldest!!.notificationId)

    return NotificationKeyValue.createOrReplace(msgId, dismissOnOpen)
  }
}

