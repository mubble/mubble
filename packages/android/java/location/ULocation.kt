package location

import android.location.Location

import org.json.JSONException
import org.json.JSONObject

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Created by
 * Siddharth on 06/07/17.
 */

class ULocation(inLocation: Location) {

  private val lat: Double = round(inLocation.latitude, 5)
  private val lng: Double = round(inLocation.longitude, 5)

  val location: JSONObject
    get() {

      val json = JSONObject()
      try {
        json.put(LAT, lat)
        json.put(LNG, lng)

      } catch (e: JSONException) {
        e.printStackTrace()
      }

      return json
    }

  private fun round(value: Double, places: Int): Double {

    if (places < 0) return value
    var bd = BigDecimal(value)
    bd = bd.setScale(places, RoundingMode.HALF_UP)
    return bd.toDouble()
  }

  companion object {

    val LAT = "lat"
    val LNG = "lng"

    fun createInstance(location: Location?): ULocation? {

      return if (location == null) null else ULocation(location)
    }
  }
}
