package `in`.mubble.android.ui.auth

import `in`.mubble.android.core.MubbleLogger
import `in`.mubble.android.ui.MubbleBaseActivity
import android.content.Intent
import org.jetbrains.anko.info

/**
 * Created by
 * siddharthgarg on 24/11/17.
 */

open class LoginManager(private val activity: MubbleBaseActivity,
                        private val partner: PARTNER,
                        private val cb: (responseCode: String, clientId: String?, idToken: String?) -> Unit): MubbleLogger {

  private val requestCode   : Int
  private val currentWorker : LoginWorker

  init {

    when(partner) {

      PARTNER.GOOGLE -> {
        currentWorker = GoogleLoginWorker(activity, this)
        requestCode   = currentWorker.signIn()
      }

      PARTNER.FACEBOOK -> {
        currentWorker = FacebookLoginWorker(activity, this)
        requestCode   = currentWorker.signIn()
      }
    }

    info { "init partner:$partner requestCode:$requestCode" }
  }

  fun onActivityResult(resultCode: Int, data: Intent?) {
    info { "onActivityResult resultCode:$resultCode" }
    currentWorker.onActivityResult(requestCode, resultCode, data)
  }

  fun isLoginRequestCode(requestCode: Int): Boolean = requestCode == this.requestCode

  fun onSignInComplete(responseCode: String, clientId: String?, idToken: String?) {

    info { "onSignInComplete responseCode:$responseCode clientId:$clientId idToken:$idToken" }
    cb(responseCode, clientId, idToken)
  }

  enum class PARTNER {
    GOOGLE,
    FACEBOOK
  }
}
