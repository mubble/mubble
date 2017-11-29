package `in`.mubble.android.ui

import android.os.Bundle
import android.os.PersistableBundle
import android.support.v7.app.AppCompatActivity
import org.jetbrains.anko.AnkoLogger

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


abstract class MubbleBaseActivity: AppCompatActivity(), AnkoLogger {

  final override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    onMubbleCreate(savedInstanceState, null)
  }

  final override fun onCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onCreate(savedInstanceState, persistentState)
    onMubbleCreate(savedInstanceState, persistentState)
  }

  open fun onMubbleCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {

  }


}