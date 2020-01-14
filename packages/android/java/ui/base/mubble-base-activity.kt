package ui.base

import android.app.ProgressDialog
import android.content.Intent
import android.os.Bundle
import android.os.PersistableBundle
import androidx.appcompat.app.AppCompatActivity
import core.BaseApp
import core.MubbleLogger
import ui.permission.AskedPermission
import ui.permission.PermissionGroup

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 23/11/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

abstract class MubbleBaseActivity: AppCompatActivity(), MubbleLogger {

  private var loadedPreAppInit  : Boolean         = false
  private var progressDialog    : ProgressDialog? = null

  abstract fun showRationaleDialog(groups: MutableSet<AskedPermission>, cb: (Boolean) -> Unit)
  abstract fun showPermSettingDialog(groups : ArrayList<PermissionGroup>)

  final override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    loadedPreAppInit = !BaseApp.instance.isAppInitialized(this)

    if (loadedPreAppInit) {
      setContentView(BaseApp.instance.splashResourceId)
    } else {
      onMubbleCreate(savedInstanceState, null)
    }
  }

  final override fun onCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onCreate(savedInstanceState, persistentState)

    loadedPreAppInit = !BaseApp.instance.isAppInitialized(this)

    if (loadedPreAppInit) {
      setContentView(BaseApp.instance.splashResourceId)
    } else {
      onMubbleCreate(savedInstanceState, persistentState)
    }
  }

  final override fun onPostCreate(savedInstanceState: Bundle?, persistentState: PersistableBundle?) {
    super.onPostCreate(savedInstanceState, persistentState)

    if (loadedPreAppInit) return
    onMubblePostCreate(savedInstanceState, persistentState)
  }

  final override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)

    if (loadedPreAppInit) return
    onMubblePostCreate(savedInstanceState, null)
  }

  final override fun onRestart() {
    super.onRestart()

    if (loadedPreAppInit) return
    onMubbleRestart()
  }

  final override fun onStart() {
    super.onStart()

    if (loadedPreAppInit) return
    onMubbleStart()
  }

  final override fun onResume() {
    super.onResume()

    if (loadedPreAppInit) return
    onMubbleResume()
  }

  final override fun onResumeFragments() {
    super.onResumeFragments()

    if (loadedPreAppInit) return
    onMubbleResumeFragments()
  }

  final override fun onPostResume() {
    super.onPostResume()

    if (loadedPreAppInit) return
    onMubblePostResume()
  }

  final override fun onPause() {
    super.onPause()

    if (loadedPreAppInit) return
    onMubblePause()
  }

  final override fun onStop() {
    super.onStop()

    if (loadedPreAppInit) return
    onMubbleStop()
  }

  final override fun onDestroy() {
    super.onDestroy()
    if (loadedPreAppInit) return
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
    if (getIntent().extras != null) intent.putExtras(getIntent().extras!!)
    intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)

    finish()
    overridePendingTransition(0, 0)

    startActivity(intent)
    overridePendingTransition(0, 0)
  }

  fun bringToTop() {

    val intent = Intent(this, this::class.java)
    if (getIntent().extras != null) intent.putExtras(getIntent().extras!!)
    intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
    intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    startActivity(intent)
  }

  fun showProgressDialog(message: String = "Please wait") {

    if (progressDialog == null) {
      progressDialog = ProgressDialog(this)
      progressDialog!!.setMessage(message)
      progressDialog!!.isIndeterminate = true
    }
    progressDialog!!.show()
  }

  fun hideProgressDialog() {

    if (progressDialog != null && progressDialog!!.isShowing) {
      progressDialog!!.dismiss()
    }
  }


}