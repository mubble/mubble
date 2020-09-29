package doorsanchar

import android.content.Context
import android.os.Bundle
import android.telephony.SmsMessage
import android.util.Log
import org.json.JSONObject

/**
 * Created by
 * siddharthgarg on 23/03/18.
 */

class SmsSanchar private constructor(private var context: Context) {

  private var stringToken: String? = null

  companion object {

    @Volatile private var instance: SmsSanchar? = null

    fun getInstance(context: Context): SmsSanchar =
        instance ?: synchronized(this) {
          instance ?: build(context).also { instance = it }
        }

    private fun build(context: Context) = SmsSanchar(context)
  }

  fun setStringToken(stringToken: String) {
    this.stringToken = stringToken
  }

  fun checkForSmsCode(event: Bundle?): JSONObject {

    val jsonObj = JSONObject()
    jsonObj.put("hasSmsCode", false)

    Log.i("SmsSanchar", "Got sms: $event")
    if (event == null || event.isEmpty) return jsonObj

    val pdus = event.get("pdus") as Array<*>

    val sms: SmsMessage = SmsMessage.createFromPdu(pdus[0] as ByteArray)
    val body: String?   = sms.displayMessageBody

    if (stringToken != null && body != null && body.contains(stringToken!!)) {
      stringToken = null
      jsonObj.put("hasSmsCode", true)
      jsonObj.put("smsBody", body)
      return jsonObj
    }

    return jsonObj
  }

  fun destroy() {
    instance = null
  }

}