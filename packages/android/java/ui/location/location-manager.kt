package ui.location

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.location.Location
import android.os.Looper
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.*
import core.MubbleLogger
import location.ULocation
import org.json.JSONObject
import ui.base.MubbleBaseActivity
import util.AndroidBase
import java.util.*

/**
 * Created by
 * siddharthgarg on 29/01/18.
 */

class ULocationManager(private val parentActivity: MubbleBaseActivity): MubbleLogger {

  private var mFusedLocationClient        : FusedLocationProviderClient?  = null
  private var mSettingsClient             : SettingsClient?               = null
  private var mLocationRequest            : LocationRequest?              = null
  private var mLocationSettingsRequest    : LocationSettingsRequest?      = null
  private var mLocationCallback           : LocationCallback?             = null
  private var mCurrentLocation            : Location?                     = null
  private var finishLocationTask          : Timer?                        = null
  private var mRequestingLocationUpdates  : Boolean                       = false

  private lateinit var listener           : (JSONObject) -> Unit

  companion object {

    const val TAG                                     : String  = "ULocationManager"
    const val REQUEST_CHECK_SETTINGS                  : Int     = 0x1
    const val UPDATE_INTERVAL_IN_MILLISECONDS         : Long    = 10000
    const val FASTEST_UPDATE_INTERVAL_IN_MILLISECONDS : Long    = 2000
    const val TIMEOUT                                 : Long    = 20000
  }

  fun getLocation(listener: (JSONObject) -> Unit) {

    finishLocationTask?.cancel()

    this.listener = listener

    if (mLocationCallback == null) {

      // Create Location update callback
      mLocationCallback = object : LocationCallback() {
        override fun onLocationResult(locationResult: LocationResult?) {
          super.onLocationResult(locationResult)

          mCurrentLocation = locationResult!!.lastLocation
          updateLocationUI()
        }
      }

      mFusedLocationClient  = LocationServices.getFusedLocationProviderClient(parentActivity)
      mSettingsClient       = LocationServices.getSettingsClient(parentActivity)

      // Prepare Location request
      mLocationRequest = LocationRequest()
      mLocationRequest!!.interval         = UPDATE_INTERVAL_IN_MILLISECONDS
      mLocationRequest!!.fastestInterval  = FASTEST_UPDATE_INTERVAL_IN_MILLISECONDS
      mLocationRequest!!.priority         = LocationRequest.PRIORITY_HIGH_ACCURACY

      // Build Location settings request in case GPS/Network is disabled
      val builder = LocationSettingsRequest.Builder()
      builder.addLocationRequest(mLocationRequest!!)
      mLocationSettingsRequest = builder.build()
    }

    if (mRequestingLocationUpdates) return
    mRequestingLocationUpdates = true
    startLocationUpdates()
  }

  fun isLocationRequestCode(requestCode: Int) = requestCode == REQUEST_CHECK_SETTINGS

  @SuppressLint("MissingPermission")
  private fun startLocationUpdates() {

    // Begin by checking if the device has the necessary location settings.
    mSettingsClient!!.checkLocationSettings(mLocationSettingsRequest)
        .addOnSuccessListener {

          mFusedLocationClient!!.requestLocationUpdates(mLocationRequest,
              mLocationCallback, Looper.myLooper())

          setTimeout()
        }
        .addOnFailureListener {

          when ((it as ApiException).statusCode) {

            LocationSettingsStatusCodes.RESOLUTION_REQUIRED -> {
              try {
                // Show the dialog by calling startResolutionForResult(), and check the result in onActivityResult().
                val rae = it as ResolvableApiException
                rae.startResolutionForResult(parentActivity, REQUEST_CHECK_SETTINGS)
              } catch (sie: IntentSender.SendIntentException) {
                updateLocationUI()
              }
            }

            LocationSettingsStatusCodes.SETTINGS_CHANGE_UNAVAILABLE -> updateLocationUI()
          }
        }

  }

  fun stopLocationUpdates() {

    if (mLocationCallback == null) return

    // It is a good practice to remove location requests when the activity is in a paused or
    // stopped state. Doing so helps battery performance and is especially
    // recommended in applications that request frequent location updates.
    mFusedLocationClient!!.removeLocationUpdates(mLocationCallback)
        .addOnCompleteListener {
          mRequestingLocationUpdates = false
          mLocationCallback = null
        }
  }

  @Suppress("UNUSED_PARAMETER")
  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {

    when (resultCode) {
      Activity.RESULT_OK        -> startLocationUpdates()
      Activity.RESULT_CANCELED  -> updateLocationUI()
    }
  }

  private fun setTimeout() {

    finishLocationTask?.cancel()

    finishLocationTask = Timer()
    finishLocationTask!!.schedule(object : TimerTask() {
      override fun run() {
        if (mLocationCallback != null) updateLocationUI()
      }
    }, TIMEOUT)
  }

  private fun updateLocationUI() {

    finishLocationTask?.cancel()

    stopLocationUpdates()

    val location = JSONObject()

    if (mCurrentLocation != null) {
      location.put("lat", mCurrentLocation!!.latitude)
      location.put("lng", mCurrentLocation!!.longitude)

    } else {
      val locJson = AndroidBase.getCurrentLocation(parentActivity)
      location.put("lat", locJson.get(ULocation.LAT))
      location.put("lng", locJson.get(ULocation.LNG))
    }

    listener(location)
  }
}

