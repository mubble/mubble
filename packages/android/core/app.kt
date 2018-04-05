package `in`.mubble.android.core

import `in`.mubble.android.ui.MubbleBaseActivity
import android.app.Application
import java.lang.ref.WeakReference

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

abstract class MyApp : Application() {

  abstract val splashResourceId : Int
  private  var initDone         : Boolean = false // late
  private  var notifyActivity   : WeakReference<MubbleBaseActivity>? = null

  override fun onCreate() {
    super.onCreate()

    onAppInit()
  }

  fun isAppInitialized(activity: MubbleBaseActivity? = null): Boolean {

    if (initDone) return true
    if (activity !== null) notifyActivity = WeakReference(activity)
    return false
  }

  protected abstract fun onAppInit()

  protected open fun onAppInitComplete() {

    check(!initDone)

    initDone = true

    if (notifyActivity === null) return

    val activity = notifyActivity!!.get()
    activity?.mubbleAppInitialized()
    notifyActivity = null
  }
}
