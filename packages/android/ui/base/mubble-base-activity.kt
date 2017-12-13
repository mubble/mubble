package `in`.mubble.android.ui

import `in`.mubble.android.core.App
import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.newschat.app.Const
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.PersistableBundle
import android.support.v7.app.AppCompatActivity
import org.jetbrains.anko.info

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

abstract class MubbleBaseActivity: AppCompatActivity(), MubbleLogger {

  private val broadCastReceiver: BroadcastReceiver = object : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {

      val action = intent.action ?: return

      if (action == Const.LocalBroadcastMsg.ACTION) {
        val payloadId = intent.getStringExtra(Const.LocalBroadcastMsg.PAYLOAD_ID)
        info {"Received a Broadcast message: $payloadId"}

        if (payloadId == Const.LocalBroadcastMsg.Payload.INIT_DONE) {
          relaunchSelf()
        } else {
          onMubbleLocalBroadcast(payloadId, intent)
        }
      }
    }
  }

  final override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!App.instance.isAppInitialized(this)) {
      setContentView(App.instance.splashResourceId)
    } else {
      onMubbleCreate(savedInstanceState, null)
    }
  }

  final override fun onCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onCreate(savedInstanceState, persistentState)
    if (!App.instance.isAppInitialized(this)) {
      setContentView(App.instance.splashResourceId)
    } else {
      onMubbleCreate(savedInstanceState, persistentState)
    }
  }

  final override fun onPostCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onPostCreate(savedInstanceState, persistentState)

    if (!App.instance.isAppInitialized()) return
    onMubblePostCreate(savedInstanceState, persistentState)
  }

  final override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)

    if (!App.instance.isAppInitialized()) return
    onMubblePostCreate(savedInstanceState, null)
  }

  final override fun onRestart() {
    super.onRestart()

    if (!App.instance.isAppInitialized()) return
    onMubbleRestart()
  }

  final override fun onStart() {
    super.onStart()

    if (!App.instance.isAppInitialized()) return
    onMubbleStart()
  }

  final override fun onResume() {
    super.onResume()

    if (!App.instance.isAppInitialized()) return
    onMubbleResume()
  }

  final override fun onResumeFragments() {
    super.onResumeFragments()

    if (!App.instance.isAppInitialized()) return
    onMubbleResumeFragments()
  }

  final override fun onPostResume() {
    super.onPostResume()

    if (!App.instance.isAppInitialized()) return
    onMubblePostResume()
  }

  final override fun onPause() {
    super.onPause()

    if (!App.instance.isAppInitialized()) return
    onMubblePause()
  }

  final override fun onStop() {
    super.onStop()

    if (!App.instance.isAppInitialized()) return
    onMubbleStop()
  }

  final override fun onDestroy() {
    super.onDestroy()
    if (!App.instance.isAppInitialized()) return
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

  open fun onMubbleLocalBroadcast(payloadId: String, intent: Intent) {

  }

  fun mubbleAppInitialized() {
    relaunchSelf()
  }

  fun relaunchSelf() {

    val intent = Intent(this, this::class.java)
    if (getIntent().extras != null) intent.putExtras(getIntent().extras)
    intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)

    finish()
    overridePendingTransition(0, 0)

    startActivity(intent)
    overridePendingTransition(0, 0)
  }

}