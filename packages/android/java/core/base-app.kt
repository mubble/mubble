package core

import android.app.Application
import storage.ConfigKeyValue
import storage.GlobalKeyValue
import storage.UserKeyValue
import ui.base.MubbleBaseActivity
import java.lang.ref.WeakReference

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

abstract class BaseApp : Application() {

  abstract val splashResourceId : Int
  abstract val defaultClientId  : String
  abstract val isDebugApp       : Boolean
  abstract var sessionId        : Long

  abstract val userKeyVal       : UserKeyValue
  abstract val globalKeyVal     : GlobalKeyValue
  abstract val configKeyVal     : ConfigKeyValue

  private  var initDone         : Boolean = false // late
  private  var notifyActivity   : WeakReference<MubbleBaseActivity>? = null

  protected abstract fun onAppInit()

  companion object {
    lateinit var instance: BaseApp
  }

  override fun onCreate() {
    super.onCreate()

    instance = this
    onAppInit()
  }

  fun isAppInitialized(activity: MubbleBaseActivity? = null): Boolean {

    if (initDone) return true
    if (activity !== null) notifyActivity = WeakReference(activity)

    return false
  }

  protected open fun onAppInitComplete() {

    check(!initDone)

    initDone = true

    if (notifyActivity === null) return

    val activity = notifyActivity!!.get()
    activity?.mubbleAppInitialized()
    notifyActivity = null
  }
}

