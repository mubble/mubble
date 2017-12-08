package `in`.mubble.android.core

import android.app.Application

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

object App {
  val instance: Application by lazy {
    MyApp.instance!!
  }
}

class MyApp : Application() {

  companion object {
    internal var instance: Application? = null
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

}