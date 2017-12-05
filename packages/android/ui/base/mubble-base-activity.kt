package `in`.mubble.android.ui

import `in`.mubble.android.core.MubbleLogger
import android.os.Bundle
import android.os.PersistableBundle
import android.support.v7.app.AppCompatActivity

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


abstract class MubbleBaseActivity: AppCompatActivity(), MubbleLogger {

  final override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    onMubbleCreate(savedInstanceState, null)
  }

  final override fun onCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onCreate(savedInstanceState, persistentState)
    onMubbleCreate(savedInstanceState, persistentState)
  }

  final override fun onPostCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onPostCreate(savedInstanceState, persistentState)
    onMubblePostCreate(savedInstanceState, persistentState)
  }

  final override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)
    onMubblePostCreate(savedInstanceState, null)
  }

  final override fun onRestart() {
    super.onRestart()
    onMubbleRestart()
  }

  final override fun onStart() {
    super.onStart()
    onMubbleStart()
  }

  final override fun onResume() {
    super.onResume()
    onMubbleResume()
  }

  final override fun onResumeFragments() {
    super.onResumeFragments()
    onMubbleResumeFragments()
  }

  final override fun onPostResume() {
    super.onPostResume()
    onMubblePostResume()
  }

  final override fun onPause() {
    super.onPause()
    onMubblePause()
  }

  final override fun onStop() {
    super.onStop()
    onMubbleStop()
  }

  final override fun onDestroy() {
    super.onDestroy()
    onMubbleDestroy()
  }

  open fun onMubbleCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {

  }

  open fun onMubblePostCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {

  }

  open fun onMubbleRestart() {

  }

  open fun onMubbleStart() {

  }

  open fun onMubbleResume() {

  }

  open fun onMubbleResumeFragments() {

  }

  open fun onMubblePostResume() {

  }

  open fun onMubblePause() {

  }

  open fun onMubbleStop() {

  }

  open fun onMubbleDestroy() {

  }

}