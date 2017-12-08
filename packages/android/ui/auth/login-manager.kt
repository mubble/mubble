package `in`.mubble.android.ui.auth

import `in`.mubble.android.ui.MubbleBaseActivity
import android.content.Intent

/**
 * Created by
 * siddharthgarg on 24/11/17.
 */

open class LoginManager(private val activity: MubbleBaseActivity,
                        private val partner: PARTNER,
                        private val cb: (responseCode: String, clientId: String?, idToken: String?) -> Unit) {

  private var requestCode   : Int           = -1
  private var currentWorker : LoginWorker?  = null

  init {

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

  }

  fun onActivityResult(resultCode: Int, data: Intent) = currentWorker!!.onActivityResult(requestCode, resultCode, data)

  fun isLoginRequestCode(requestCode: Int): Boolean = requestCode == this.requestCode

  fun onSignInComplete(responseCode: String, clientId: String?, idToken: String?) {

    cb(responseCode, clientId, idToken)
    currentWorker = null
  }

  enum class PARTNER {
    GOOGLE,
    FACEBOOK
  }
}
