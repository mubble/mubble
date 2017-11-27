package android.ui

import android.ui.MubbleBaseActivity
import `in`.mubble.newschat.R
import android.app.ProgressDialog
import android.content.Intent
import android.os.Bundle
import com.google.android.gms.auth.api.Auth
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.api.GoogleApiClient
import com.google.android.gms.common.api.Scope
import com.google.api.services.people.v1.PeopleScopes
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider

/**
 * Created by
 * siddharthgarg on 16/06/17.
 */

internal class GoogleLoginWorker(private val activity: MubbleBaseActivity, loginMgr: LoginManager) : LoginManager.LoginWorker(loginMgr), GoogleApiClient.OnConnectionFailedListener {

  private var mGoogleApiClient: GoogleApiClient? = null
  private var progressDialog: ProgressDialog? = null
  private var sessionSignOut: Boolean = false

  init {

    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestServerAuthCode(activity.getString(R.string.default_web_client_id))
    .requestIdToken(activity.getString(R.string.default_web_client_id))
    .requestEmail()
    .requestScopes(Scope(PeopleScopes.USERINFO_PROFILE),
                   Scope(PeopleScopes.USER_BIRTHDAY_READ))
    .build()

    mGoogleApiClient = GoogleApiClient.Builder(activity)
    .addOnConnectionFailedListener(this)
    .enableAutoManage(activity, this)
    .addApi(Auth.GOOGLE_SIGN_IN_API, gso)
    .build()
  }

  fun attemptSilentSignIn(emailId: String) {

    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestServerAuthCode(activity.getString(R.string.default_web_client_id))
    .requestIdToken(activity.getString(R.string.default_web_client_id))
    .requestEmail()
    .requestScopes(Scope(PeopleScopes.USERINFO_PROFILE),
    Scope(PeopleScopes.USER_BIRTHDAY_READ))
    .setAccountName(emailId)   // This should work..not tested
    .build()

    mGoogleApiClient = GoogleApiClient.Builder(activity)
    .addOnConnectionFailedListener(this)
    .enableAutoManage(activity, this)
    .addApi(Auth.GOOGLE_SIGN_IN_API, gso)
    .build()

    val signInIntent = Auth.GoogleSignInApi.getSignInIntent(mGoogleApiClient)
    activity.startActivityForResult(signInIntent, RC_SIGN_IN)
  }

  override fun signIn(): Int {

    sessionSignOut()

    showProgressDialog()

    val signInIntent = Auth.GoogleSignInApi.getSignInIntent(mGoogleApiClient)
    activity.startActivityForResult(signInIntent, RC_SIGN_IN)

    return RC_SIGN_IN
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent) {

    val result = Auth.GoogleSignInApi.getSignInResultFromIntent(data)

    if (result.isSuccess) {
      val account = result.signInAccount
      firebaseAuthWithGoogle(account)

    } else {
      hideProgressDialog()
      onSignInComplete(ERROR_CANCELLED, null, null)
      cleanUp()
    }
  }

  private fun sessionSignOut() {

    FirebaseAuth.getInstance().currentUser ?: return

    if (!mGoogleApiClient!!.isConnected) {
      mGoogleApiClient!!.connect()
    }

    mGoogleApiClient!!.registerConnectionCallbacks(object : GoogleApiClient.ConnectionCallbacks {
      override fun onConnected(bundle: Bundle?) {

        Auth.GoogleSignInApi.signOut(mGoogleApiClient).setResultCallback { _ -> FirebaseAuth.getInstance().signOut() }
        mGoogleApiClient!!.unregisterConnectionCallbacks(this)
      }

      override fun onConnectionSuspended(i: Int) {

      }
    })

    sessionSignOut = true
  }

  private fun showProgressDialog() {

    if (progressDialog == null) {
      progressDialog = ProgressDialog(activity)
      progressDialog!!.setMessage(activity.getString(R.string.act_wait))
      progressDialog!!.isIndeterminate = true
    }
    progressDialog!!.show()
  }

  private fun hideProgressDialog() {

    if (progressDialog != null && progressDialog!!.isShowing) {
      progressDialog!!.dismiss()
    }
  }

  override fun onConnectionFailed(connectionResult: ConnectionResult) {

    hideProgressDialog()
    onSignInComplete(ERROR_CONNECTION_FAIL, null, null)
    cleanUp()
  }

  private fun firebaseAuthWithGoogle(acct: GoogleSignInAccount?) {

    val credential = GoogleAuthProvider.getCredential(acct!!.idToken, null)
    FirebaseAuth.getInstance().signInWithCredential(credential)
    .addOnCompleteListener(activity) { task ->

      if (task.isSuccessful) {
        onSignInComplete("success",
            activity.getString(R.string.default_web_client_id), acct.idToken)

      } else {
        onSignInComplete(ERROR_SIGN_IN_FAIL, null, null)
      }
      hideProgressDialog()
      cleanUp()
    }
  }

  private fun cleanUp() {

    mGoogleApiClient!!.disconnect()
    mGoogleApiClient!!.stopAutoManage(activity)
  }

  companion object {

    val RC_SIGN_IN            = 9001
    val ERROR_CONNECTION_FAIL = "connectionFailure"
    val ERROR_SIGN_IN_FAIL    = "signInFailure"
    val ERROR_CANCELLED       = "cancelled"
  }
}
