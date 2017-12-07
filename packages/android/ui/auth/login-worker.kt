package `in`.mubble.android.ui.auth

import android.content.Intent

/**
 * Created by
 * siddharthgarg on 24/11/17.
 */

internal abstract class LoginWorker(private val loginManager: LoginManager) {

  abstract fun signIn(): Int
  abstract fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent)

  fun onSignInComplete(responseCode: String, clientId: String?, idToken: String?)
      = loginManager.onSignInComplete(responseCode, clientId, idToken)
}
