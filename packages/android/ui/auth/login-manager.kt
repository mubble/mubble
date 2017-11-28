package `in`.mubble.android.ui.auth

import `in`.mubble.android.ui.MubbleBaseActivity
import android.content.Intent

/**
 * Created by
 * siddharthgarg on 24/11/17.
 */

open class LoginManager(private val activity: MubbleBaseActivity, private val listener: LoginResultListener) {

  private var requestCode   : Int           = -1
  private var currentWorker : LoginWorker?  = null

  /**
   * @param : partner : Google/Facebook
   * @return: REQUEST_CODE on which the partner has been started.
   * Once Partner authentication is complete, result will be received in
   * activity.onActivityResult(requestCode: Int, resultCode: Int, data: Intent)
   */
  fun signIn(partner: PARTNER): Int {

    when(partner) {

      PARTNER.GOOGLE -> {
        currentWorker = GoogleLoginWorker(activity, this)
        requestCode   = currentWorker!!.signIn()
      }

      PARTNER.FACEBOOK -> {
        currentWorker = FacebookLoginWorker(activity, this)
        requestCode   = currentWorker!!.signIn()
      }
    }
    return requestCode
  }

  fun onActivityResult(resultCode: Int, data: Intent) = currentWorker!!.onActivityResult(requestCode, resultCode, data)

  fun isLoginRequestCode(requestCode: Int): Boolean = requestCode == this.requestCode

  fun onSignInComplete(responseCode: String, clientId: String?, idToken: String?) {

    listener.onLoginResult(responseCode, clientId, idToken)
    currentWorker = null
  }

  interface LoginResultListener {

    fun onLoginResult(responseCode: String, clientId: String?, idToken: String?)
  }

  enum class PARTNER {
    GOOGLE,
    FACEBOOK
  }
}
