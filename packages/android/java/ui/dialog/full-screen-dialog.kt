package ui.dialog

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.os.Bundle
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.Fragment
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.Window
import core.BaseApp
import firebase.FirebaseAnalytics
import core.MubbleLogger
import org.json.JSONObject

abstract class FullScreenDialog : DialogFragment(), MubbleLogger {

  protected var eventParams = Bundle()
  protected var listener  : OnDialogFragmentInteractionListener? = null

  private var stayTime    : Long?    = null

  abstract fun getScreenName(): String
  abstract fun onBackPressed()

  override fun onAttach(activity: Activity) {
    super.onAttach(activity)
    onAttachInternal(activity)
  }

  override fun onAttach(context: Context) {
    super.onAttach(context)
    onAttachInternal(context)
  }

  override fun onAttachFragment(childFragment: Fragment) {
    super.onAttachFragment(childFragment)
    onAttachInternal(BaseApp.instance)
  }

  override fun onStart() {
    super.onStart()

    if (dialog != null) {
      val width = ViewGroup.LayoutParams.MATCH_PARENT
      val height = ViewGroup.LayoutParams.MATCH_PARENT
      dialog!!.window!!.setLayout(width, height)
      dialog!!.window!!.setBackgroundDrawable(null)
    }

    stayTime = System.currentTimeMillis()
  }

  override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {

    val dialog = super.onCreateDialog(savedInstanceState)
    dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

    dialog.setOnKeyListener { _, keyCode, event ->

      if (keyCode == KeyEvent.KEYCODE_BACK) {
        onBackPressed()
      }
      true
    }

    return dialog
  }

  override fun onStop() {
    super.onStop()

    stayTime = System.currentTimeMillis() - stayTime!!

    eventParams.putLong("stay_time", stayTime!!)
    eventParams.putLong("session_id", BaseApp.instance.sessionId)

    FirebaseAnalytics.logEvent(BaseApp.instance, getScreenName(), eventParams)
    eventParams = Bundle()
  }

  override fun onDetach() {
    super.onDetach()

    listener?.onDialogDetach(getScreenName())
    listener = null
  }

  private fun onAttachInternal(context: Context) {

    if (context is OnDialogFragmentInteractionListener) {
      listener = context
    } else {
      throw RuntimeException(context.toString() + " must implement OnFragmentInteractionListener")
    }
  }

  interface OnDialogFragmentInteractionListener {
    fun onDialogFragmentInteraction(dialogName: String, actionName: String, result: JSONObject)
    fun onDialogDetach(dialogName: String)
  }
}
