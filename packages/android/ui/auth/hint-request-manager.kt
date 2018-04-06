package ui.auth

import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.android.ui.MubbleBaseActivity
import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import com.google.android.gms.auth.api.Auth
import com.google.android.gms.auth.api.credentials.Credential
import com.google.android.gms.auth.api.credentials.HintRequest
import com.google.android.gms.common.api.GoogleApiClient

/**
 * Created by
 * siddharthgarg on 23/03/18.
 */

open class HintRequestManager(private val activity: MubbleBaseActivity): MubbleLogger {

  private var mGoogleApiClient : GoogleApiClient? = null
  private lateinit var cb: (selId: String?) -> Unit

  companion object {
    private const val RESOLVE_HINT = 6000
  }

  init {

    if (mGoogleApiClient != null && mGoogleApiClient!!.isConnected) mGoogleApiClient!!.disconnect()

    mGoogleApiClient = GoogleApiClient.Builder(activity)
        .addOnConnectionFailedListener {
        }
        .enableAutoManage(activity, {

        })
        .addApi(Auth.CREDENTIALS_API)
        .build()

    mGoogleApiClient!!.connect()
  }

  fun requestMobNumHint(cb: (selectedId: String?) -> Unit) {

    this.cb = cb

    val hintReq: HintRequest = HintRequest.Builder()
        .setPhoneNumberIdentifierSupported(true)
        .build()


    val intent: PendingIntent = Auth.CredentialsApi.getHintPickerIntent(mGoogleApiClient, hintReq)
    activity.startIntentSenderForResult(intent.intentSender, RESOLVE_HINT, null, 0, 0, 0)
  }

  fun isHintRequestCode(requestCode: Int) = requestCode == RESOLVE_HINT

  @Suppress("UNUSED_PARAMETER")
  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {

    if (resultCode == Activity.RESULT_OK && data != null) {
      val credential: Credential = data.getParcelableExtra(Credential.EXTRA_KEY)
      cb(credential.id)
    } else {
      cb(null)
    }

    if (mGoogleApiClient != null && mGoogleApiClient!!.isConnected) mGoogleApiClient!!.disconnect()
  }

}
