package `in`.mubble.android.core

import `in`.mubble.newschat.app.Const
import android.app.Application
import android.content.Intent
import android.support.v4.content.LocalBroadcastManager

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

open class MyApp : Application() {

  var initDone : Boolean = false

  companion object {
    internal var instance: MyApp? = null
  }

  override fun onCreate() {
    super.onCreate()

    instance = this
    initialize { this.onInitDone(it) }
  }

  open fun initialize(cb: (Boolean) -> Unit) {
    cb(true)
  }

  private fun onInitDone(initDone: Boolean) {

    if (initDone) {

      this.initDone = initDone

      val intent = Intent(Const.LocalBroadcastMsg.ACTION)
      intent.putExtra(Const.LocalBroadcastMsg.PAYLOAD_ID, Const.LocalBroadcastMsg.Payload.INIT_DONE)
      LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)

    } else {
      // Init failed: codeBug
    }
  }
}

object App {
  val instance: MyApp by lazy {
    MyApp.instance!!
  }
}
