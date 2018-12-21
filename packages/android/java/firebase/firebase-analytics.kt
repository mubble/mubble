package firebase

import android.content.Context
import android.os.Bundle
import android.util.Log
import com.google.firebase.analytics.FirebaseAnalytics
import core.BaseApp
import ConstBase
import org.json.JSONException
import org.json.JSONObject
import util.AndroidBase

object FirebaseAnalytics {

  fun setUserId(context: Context, userId: String) {

    Log.d("FirebaseAnalytics", "Setting userId:: $userId")
    FirebaseAnalytics.getInstance(context).setUserId(userId)
  }

  fun setUserProperty(context: Context, key: String, value: String) {

    Log.d("FirebaseAnalytics", "Setting user property:: key: $key, value: $value")
    FirebaseAnalytics.getInstance(context).setUserProperty(key, value)
  }

  fun logEvent(context: Context, eventName: String, eventData: Bundle) {

    Log.d("FirebaseAnalytics", "Logging event: $eventName, data: ${AndroidBase.bundleToJson(eventData)}")
    eventData.putLong(ConstBase.Firebase.SESSION_ID, BaseApp.instance.sessionId)
    FirebaseAnalytics.getInstance(context).logEvent(eventName, eventData)
  }

  fun logEvent(context: Context, eventName: String, eventData: JSONObject?) {

    var bundle = Bundle()
    if (eventData != null && eventData.length() > 0) {

      try {
        bundle = AndroidBase.jsonToBundle(eventData)
      } catch (e: JSONException) {
        e.printStackTrace()
      }

    }

    Log.d("FirebaseAnalytics", "Logging event: $eventName, data: ${AndroidBase.bundleToJson(bundle)}")
    bundle.putLong(ConstBase.Firebase.SESSION_ID, BaseApp.instance.sessionId)
    FirebaseAnalytics.getInstance(context).logEvent(eventName, bundle)
  }

  fun logEvent(context: Context, eventName: String, eventDataStr: String?) {

    var bundle = Bundle()
    if (eventDataStr != null && eventDataStr.isNotEmpty()) {

      try {
        val eventData = JSONObject(eventDataStr)
        bundle = AndroidBase.jsonToBundle(eventData)
      } catch (e: JSONException) {
        e.printStackTrace()
      }

    }

    Log.d("FirebaseAnalytics", "Logging event: $eventName, data: ${AndroidBase.bundleToJson(bundle)}")
    bundle.putLong(ConstBase.Firebase.SESSION_ID, BaseApp.instance.sessionId)
    FirebaseAnalytics.getInstance(context).logEvent(eventName, bundle)
  }
}