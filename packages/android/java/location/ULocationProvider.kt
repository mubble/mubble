package location

import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Bundle
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.api.GoogleApiClient
import com.google.android.gms.location.LocationListener
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import ui.permission.PermissionGroup
import java.util.*

/**
 * Created by
 * Siddharth on 06/07/17.
 */

object ULocationProvider {

  private val LOCATION_STALE_TIME = 6 * 60 * 60 * 1000L
  private var inProgress = false
  private var lastLocation: Location? = null

  internal fun getLastLocation(context: Context): Location? {

    if (!PermissionGroup.LOCATION.hasPermission(context)) return null
    return try {
      lastLocation = newerLocation(lastLocation, lastKnownLocation(context))
      lastLocation
    } catch (ex: SecurityException) {
      ex.printStackTrace()
      null
    }
  }

  private fun lastKnownLocation(context: Context): Location? {

    var bestResult: Location? = null
    var bestAccuracy = java.lang.Float.MAX_VALUE
    val currentTime = Date().time
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val matchingProviders = locationManager.allProviders

    try {

      for (provider in matchingProviders) {
        val location = locationManager.getLastKnownLocation(provider)
        if (location != null) {
          val accuracy = location.accuracy
          val time = location.time

          if (time + LOCATION_STALE_TIME > currentTime && accuracy < bestAccuracy) {
            bestResult = location
            bestAccuracy = accuracy
          }
        }
      }

      if (bestResult == null && !inProgress) {
        inProgress = true
        FusedLocationService(context).connect()
      }

    } catch (ex: SecurityException) {
      ex.printStackTrace()
    }

    return bestResult
  }

  private fun newerLocation(first: Location?, second: Location?): Location? {

    if (first == null) return second
    if (second == null) return first

    return if (first.time > second.time) first else second
  }

  /*********************** Inner classes  */
  @Suppress("DEPRECATION")
  private class FusedLocationService internal constructor(context: Context) : LocationListener, GoogleApiClient.OnConnectionFailedListener, GoogleApiClient.ConnectionCallbacks {

    private val googleApiClient: GoogleApiClient? = GoogleApiClient.Builder(context)
        .addApi(LocationServices.API)
        .addConnectionCallbacks(this)
        .addOnConnectionFailedListener(this)
        .build()

    private val locationRequest: LocationRequest = LocationRequest.create().setPriority(LocationRequest.PRIORITY_LOW_POWER)

    internal fun connect() {

      googleApiClient?.connect()
    }

    override fun onConnected(connectionHint: Bundle?) {

      try {
        val currentLocation = LocationServices.FusedLocationApi
            .getLastLocation(googleApiClient)

        if (currentLocation != null) {
          lastLocation = currentLocation
          inProgress = false
        } else {
          LocationServices.FusedLocationApi.requestLocationUpdates(googleApiClient,
              locationRequest, this)
        }
      } catch (ex: SecurityException) {
        ex.printStackTrace()
      }
    }

    override fun onLocationChanged(location: Location) {

      lastLocation = location
      LocationServices.FusedLocationApi.removeLocationUpdates(googleApiClient, this)
      inProgress = false

    }

    override fun onConnectionFailed(connectionResult: ConnectionResult) {

    }

    override fun onConnectionSuspended(cause: Int) {

    }
  }
}
