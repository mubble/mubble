package ui.auth

import android.content.Intent
import android.os.Bundle
import com.facebook.*
import com.facebook.login.LoginResult
import com.facebook.login.widget.LoginButton
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.FirebaseAuth
import core.BaseApp
import ui.base.MubbleBaseActivity
import java.util.*

/**
 * Created by
 * siddharthgarg on 16/06/17.
 */

internal class FacebookLoginWorker(activity: MubbleBaseActivity, loginMgr: LoginManager): LoginWorker(loginMgr) {

  private val loginButton     : LoginButton
  private val callbackManager : CallbackManager
  private var profileTracker  : ProfileTracker? = null

  init {

    callbackManager = CallbackManager.Factory.create()

    loginButton = LoginButton(activity)
    loginButton.setReadPermissions(Arrays.asList("public_profile", "email"))
    loginButton.registerCallback(callbackManager, object : FacebookCallback<LoginResult> {
      override fun onSuccess(loginResult: LoginResult) {

        graphRequest(loginResult)

        val token = loginResult.accessToken
        val credential = FacebookAuthProvider.getCredential(token.token)

        FirebaseAuth.getInstance().signInWithCredential(credential)
        .addOnCompleteListener(activity
        ) { _ ->
//          if (task.isSuccessful) {
//            Log.d("Fb", "SignIn with Auth complete")
//          } else {
//            Log.d("Fb", "Failure : " + task.exception!!)
//          }
        }

        onSignInComplete("success",
            BaseApp.instance.defaultClientId, token.token)

        // TODO: check

//        if (ContactsContract.Profile.getCurrentProfile() == null) {
//          profileTracker = object : ProfileTracker() {
//            override fun onCurrentProfileChanged(oldProfile: ContactsContract.Profile?, currentProfile: ContactsContract.Profile) {
//              profileTracker!!.stopTracking()
//              ContactsContract.Profile.setCurrentProfile(currentProfile)
//            }
//          }
//        }
      }

      override fun onCancel() {
        onSignInComplete(ERROR_CANCELLED, null, null)
      }

      override fun onError(error: FacebookException) {
        onSignInComplete(ERROR_SIGN_IN_FAIL, null, null)
      }
    })
  }

  override fun signIn(): Int {
    loginButton.performClick()
    return loginButton.requestCode
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    callbackManager.onActivityResult(requestCode, resultCode, data)
  }

  private fun graphRequest(loginResult: LoginResult) {

    val request = GraphRequest.newMeRequest(
    loginResult.accessToken) { _, _ ->

//      Log.d("Fb", "Object : " + jsonObject.toString())
//      Log.d("Fb", "Response : " + jsonObject.toString())
    }

    val parameters = Bundle()
    parameters.putString("fields", "id,age_range,name,first_name,last_name,email,gender,birthday,location")
    request.parameters = parameters
    request.executeAsync()
  }

  companion object {

    const val ERROR_SIGN_IN_FAIL  = "signInFailure"
    const val ERROR_CANCELLED     = "cancelled"
  }
}
