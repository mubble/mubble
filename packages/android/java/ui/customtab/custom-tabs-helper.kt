package ui.customtab

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import android.app.Activity
import androidx.browser.customtabs.CustomTabsServiceConnection
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsSession
import android.content.ComponentName
import android.os.Bundle

internal class CustomTabsHelper {

  private var customTabsSession   : CustomTabsSession?            = null
  private var client              : CustomTabsClient?             = null
  private var connection          : CustomTabsServiceConnection?  = null
  private var connectionCallback  : ConnectionCallback?           = null

  companion object {

    fun openCustomTab(context: Context, intent: CustomTabsIntent, uri: Uri) {
      intent.launchUrl(context, uri)
    }
  }

  fun bindCustomTabsService(activity: Activity) {

    if (client != null) {
      return
    }

    connection = object : CustomTabsServiceConnection() {
      override fun onCustomTabsServiceConnected(name: ComponentName, client: CustomTabsClient) {
        this@CustomTabsHelper.client = client
        this@CustomTabsHelper.client!!.warmup(0L)
        if (connectionCallback != null) {
          connectionCallback!!.onCustomTabsConnected()
        }
        //Initialize a session as soon as possible.
        getSession()
      }

      override fun onServiceDisconnected(name: ComponentName) {
        client = null
        if (connectionCallback != null) {
          connectionCallback!!.onCustomTabsDisconnected()
        }
      }

      override fun onBindingDied(name: ComponentName) {
        client = null
        if (connectionCallback != null) {
          connectionCallback!!.onCustomTabsDisconnected()
        }
      }
    }
    CustomTabsClient.bindCustomTabsService(activity, "com.android.chrome", connection!!)
  }

  fun unbindCustomTabsService(activity: Activity) {

    if (connection == null)
    activity.unbindService(connection!!)
    client = null
    customTabsSession = null
  }

  fun getSession(): CustomTabsSession? {

    if (client == null) {
      customTabsSession = null
      return null
    }

    if (customTabsSession == null) customTabsSession = client!!.newSession(null)
    return customTabsSession!!
  }

  fun mayLaunchUrl(uri: Uri, extras: Bundle, bundle: List<Bundle>): Boolean {

    if (client == null) return false

    val session = getSession()
    return session != null && session.mayLaunchUrl(uri, extras, bundle)
  }

  interface ConnectionCallback {
    /**
     * Called when the service is connected
     */
    fun onCustomTabsConnected()

    /**
     * Called when the service is disconnected
     */
    fun onCustomTabsDisconnected()
  }

}