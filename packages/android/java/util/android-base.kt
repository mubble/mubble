package util

import android.accounts.AccountManager
import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.*
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.LayerDrawable
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.ConnectivityManager
import android.net.NetworkInfo
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import androidx.annotation.ColorRes
import android.telephony.TelephonyManager
import android.text.Html
import android.text.Spanned
import android.util.Base64
import android.util.DisplayMetrics
import android.util.Log
import android.util.Pair
import android.view.WindowManager
import android.widget.Toast
import com.google.android.gms.ads.identifier.AdvertisingIdClient
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.GooglePlayServicesNotAvailableException
import com.google.android.gms.common.GooglePlayServicesRepairableException
import core.BaseApp
import ConstBase
import location.ULocation
import location.ULocationProvider
import org.hashids.Hashids
import org.jetbrains.anko.doAsync
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import ui.base.MubbleBaseActivity
import ui.permission.PermissionGroup
import java.io.*
import java.net.URL
import java.util.*
import java.util.regex.Pattern

/**
 * Created by
 * siddharthgarg on 15/06/17.
 */

private const val PLAY_SERVICES_RESOLUTION_REQUEST = 1000

object AndroidBase {

  private val TAG = "AndroidBase"

  val cpuInfo: String
    get() {

      try {
        return readTextFile("/proc/cpuinfo")
      } catch (e: Exception) {
        return "unknown"
      }

    }

  // Get the Number value from the string
  val ramInfo: String
    get() {

      val reader: RandomAccessFile
      val load: String

      try {
        reader = RandomAccessFile("/proc/meminfo", "r")
        load = reader.readLine()
        val p = Pattern.compile("(\\d+)")
        val m = p.matcher(load)
        var value = ""

        while (m.find()) value = m.group(1)
        reader.close()

        val totRam = java.lang.Double.parseDouble(value) / 1024
        return totRam.toInt().toString() + " MB"

      } catch (ex: IOException) {
        return "unknown"
      }

    }

  internal enum class NetworkType private constructor(var value: String) {

    NET_2G("2G"),
    NET_3G("3G"),
    NET_4G("4G"),
    NET_5G("5G"),
    WIFI("wifi"),
    UNKNOWN("unk"),
    ABSENT("absent")
  }

  fun sanitizeInstallParams(params: JSONObject) {

    val regExp = Pattern.compile("NOT_SET|not_set|not%20set|NOT%20SET")

    for (key in params.keys()) {
      if (regExp.matcher(params.getString(key)).find()) params.put(key, "")
    }
  }

  fun getInstallPackages(): JSONArray {

    val insPckgs = JSONArray()

    BaseApp.instance.packageManager.getInstalledPackages(PackageManager.GET_META_DATA)
        .map { it.packageName }
        .forEach { insPckgs.put(it) }

    return insPckgs
  }

  fun convertUrlFromHashids(url: String): String {

    try {

      val hashIdMap = getQueryMapFromUrl(url)
      val hashIds   = Hashids(ConstBase.HASH_IDS_KEY)

      var uri = url.substring(0, url.indexOf("?") + 1)
      var idx = 0

      hashIdMap.keys.forEach {

        val hashValue = hashIdMap[it]!!

        var queryKey    = it
        var queryValue  = hashValue

        val keyArr    = hashIds.decode(it)
        val valueArr  = hashIds.decode(hashValue)

        var key = ""
        keyArr.forEach {
          key += it.toChar()
        }

        if (key.startsWith("__")) { // HashId Key present

          var value = ""
          valueArr.forEach {
            value += it.toChar()
          }

          queryKey   = key
          queryValue = value
        }

        uri += "$queryKey=$queryValue"
        if (idx < hashIdMap.keys.size) uri += "&"
        idx++
      }

      return uri

    } catch (e: Exception) {
      return url
    }
  }

  fun getBitmapFromUrl(url: String): Bitmap? {

    var bitmap: Bitmap?
    if (url.isNullOrBlank()) {
      bitmap = null

    } else {
      try {
        bitmap = BitmapFactory.decodeStream(URL(url).content as InputStream)

      } catch (e: IOException) {
        bitmap = null
      }

    }

    return bitmap
  }

  fun getPhoneContacts(context: Context, cb: (JSONObject) -> Unit) {

    if (!PermissionGroup.CONTACTS.hasPermission(context)) {
      cb(JSONObject())
      return
    }

    doAsync {
      val jsonArray = JSONArray()

      val phones: Cursor = context.contentResolver.query(ContactsContract
          .CommonDataKinds.Phone.CONTENT_URI, null, null, null, null)!!

      while (phones.moveToNext()) {

        val name  = phones.getString(phones.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME))
        val phone = phones.getString(phones.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER))

        val json = JSONObject()
        json.put("displayName", name)
        json.put("number", phone)
        jsonArray.put(json)
      }

      phones.close()

      val jsonObj = JSONObject()
      jsonObj.put("contacts", jsonArray)

      cb(jsonObj)
    }
  }

  /**
   * test?key1=1&key2=temp
   */
  fun getQueryMap(query: String): MutableMap<String, String> {

    val qr     = query.replace("?", "&")
    val params = qr.split("&")
    val map    = mutableMapOf<String, String>()

    params.forEach {
      val arr: List<String> = it.split("=")
      if (arr.size > 1) map[arr[0]] = arr[1]
    }

    return map
  }

  fun getQueryMapFromUrl(url: String): MutableMap<String, String>  {

    val map = mutableMapOf<String, String>()

    val paramsIdx = url.indexOf("?")

    val urlPrefix = url.substring(0, if (paramsIdx == -1) url.length else paramsIdx)
    map["urlPrefix"] = urlPrefix

    if (paramsIdx != -1) {
      val idx       = url.lastIndexOf("/")
      val searchUrl = url.substring(idx + 1)

      map.putAll(getQueryMap(searchUrl))
    }

    return map
  }

  fun addQueryToUrl(url: String, key: String, value: String): String {

    val paramsIdx = url.indexOf("?")

    var genUrl = if (paramsIdx == -1) url.plus("?") else url.plus("&")
    genUrl = genUrl.plus("$key=$value")

    return genUrl
  }

  fun checkPlayServices(context: Context): Int {

    val googleAPI = GoogleApiAvailability.getInstance()
    return googleAPI.isGooglePlayServicesAvailable(context)
    //Google Play Services is available. Return true.
  }

  fun updatePlayServices(activity: MubbleBaseActivity, result: Int): Boolean {

    if (result != ConnectionResult.SUCCESS) {

      //Google Play Services app is not available or version is not up to date. Error the
      // error condition here
      val googleAPI = GoogleApiAvailability.getInstance()

      if (googleAPI.isUserResolvableError(result)) {
        googleAPI.getErrorDialog(activity, result,
            PLAY_SERVICES_RESOLUTION_REQUEST).show()
        return true
      }
      return false
    }
    return true
  }

  fun getCurrentLocation(activity: Context): JSONObject {

    val currLoc = ULocation.createInstance(
        ULocationProvider.getLastLocation(activity))

    var locObject = JSONObject()
    if (currLoc != null) locObject = currLoc.location
    return locObject
  }

  fun invokePlayStore(context: Context, dataUri: String) {

    val intent = Intent(Intent.ACTION_VIEW)

    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)

    try {
      intent.data = Uri.parse("market://details?id=" + dataUri)
      context.startActivity(intent)

    } catch (anfe: android.content.ActivityNotFoundException) {
      intent.data = Uri.parse("https://play.google.com/store/apps/details?id=" + dataUri)
      context.startActivity(intent)
    }
  }

  fun resetApp(context: Activity) {

    val am  : ActivityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    am.clearApplicationUserData()
  }

  fun isActiveNetwork(context: Context): Boolean {

    val netType = getCurrentNetworkType(context)
    return !(netType === NetworkType.UNKNOWN.value || netType === NetworkType.ABSENT.value)
  }

  fun getCurrentNetworkType(context: Context): String {

    val cm = context
        .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    return getNetworkGeneration(cm.activeNetworkInfo).value
  }

  private fun getNetworkGeneration(actNet: NetworkInfo?): NetworkType {

    if (actNet == null) return NetworkType.UNKNOWN
    if (!actNet.isAvailable || !actNet.isConnected) return NetworkType.ABSENT
    if (actNet.type == ConnectivityManager.TYPE_WIFI || actNet.type == ConnectivityManager.TYPE_WIMAX)
      return NetworkType.WIFI

    when (actNet.subtype) {

      TelephonyManager.NETWORK_TYPE_UNKNOWN -> return NetworkType.UNKNOWN

      //these are 4G
      TelephonyManager.NETWORK_TYPE_LTE    // ~ 10+ Mbps
        , TelephonyManager.NETWORK_TYPE_IWLAN -> return NetworkType.NET_4G

      // these are 3G
      TelephonyManager.NETWORK_TYPE_EVDO_0 // ~ 400-1000 kbps
        , TelephonyManager.NETWORK_TYPE_EVDO_A // ~ 600-1400 kbps
        , TelephonyManager.NETWORK_TYPE_HSDPA  // ~ 2-14 Mbps
        , TelephonyManager.NETWORK_TYPE_HSPA   // ~ 700-1700 kbps
        , TelephonyManager.NETWORK_TYPE_HSUPA  // ~ 1-23 Mbps
        , TelephonyManager.NETWORK_TYPE_UMTS   // ~ 400-7000 kbps
        , TelephonyManager.NETWORK_TYPE_EHRPD  // ~ 1-2 Mbps
        , TelephonyManager.NETWORK_TYPE_EVDO_B // ~ 5 Mbps
        , TelephonyManager.NETWORK_TYPE_HSPAP  // ~ 10-20 Mbps
        , TelephonyManager.NETWORK_TYPE_TD_SCDMA -> return NetworkType.NET_3G

      // these are 2G
      TelephonyManager.NETWORK_TYPE_1xRTT // ~ 50-100 kbps
        , TelephonyManager.NETWORK_TYPE_CDMA  // ~ 14-64 kbps
        , TelephonyManager.NETWORK_TYPE_EDGE  // ~ 50-100 kbps
        , TelephonyManager.NETWORK_TYPE_GPRS  // ~ 100 kbps
        , TelephonyManager.NETWORK_TYPE_IDEN  // API level 8 ~25 kbps
        , TelephonyManager.NETWORK_TYPE_GSM -> return NetworkType.NET_2G
      else -> return NetworkType.NET_2G
    }
  }

  fun getAppVersion(mContext: Context): Int {

    try {
      val pInfo = mContext.packageManager
          .getPackageInfo(mContext.packageName, 0)
      return pInfo.versionCode

    } catch (e: PackageManager.NameNotFoundException) {
      return -1
    }
  }

  fun getAppInstallTime(mContext: Context): Long {

    val pInfo = mContext.packageManager
        .getPackageInfo(mContext.packageName, 0)
    return pInfo.firstInstallTime
  }

  fun getAccounts(mContext: Context): JSONArray {

    val emails = JSONArray()
    val accounts = AccountManager.get(mContext)
        .getAccountsByType("com.google")
    for (account in accounts) {
      emails.put(account.name)
    }
    return emails
  }

  fun getDisplaySize(context: Context): Pair<Int, Int> {

    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val display = wm.defaultDisplay
    val size = Point()
    display.getSize(size)
    return Pair.create(size.y, size.x)
  }

  fun getSensorList(context: Context): List<Sensor> {

    val smm = context.getSystemService(
        Context.SENSOR_SERVICE) as SensorManager
    return smm.getSensorList(Sensor.TYPE_ALL)
  }

  fun getBatteryCapacity(context: Context): String {

    val POWER_PROFILE_CLASS = "com.android.internal.os.PowerProfile"
    try {
      val mPowerProfile_ = Class.forName(POWER_PROFILE_CLASS)
          .getConstructor(Context::class.java).newInstance(context)

      return Class.forName(POWER_PROFILE_CLASS)
          .getMethod("getBatteryCapacity")
          .invoke(mPowerProfile_).toString() + "mAh"

    } catch (e: Throwable) {
      return "unknown"
    }

  }

  fun readTextFile(filePath: String): String {
    var reader: BufferedReader? = null
    val builder = StringBuilder()
    try {
      reader = BufferedReader(InputStreamReader(FileInputStream(filePath)))
      var line: String? = reader.readLine()

      while (line != null) {
        builder.append(line)
        line = reader.readLine()
      }

    } catch (e: IOException) {
      e.printStackTrace()
    } finally {
      if (reader != null) {
        try {
          reader.close()
        } catch (e: IOException) {
          e.printStackTrace()
        }

      }
    }
    return builder.toString()
  }

  @SuppressWarnings("all")
  fun getBitmapFromDrawable(drawable: Drawable): Bitmap {

    if (drawable is BitmapDrawable) {

      if (drawable.bitmap != null) {
        return drawable.bitmap
      }
    }

    val bitmap: Bitmap

    if (drawable is AdaptiveIconDrawable) {

      val drr = arrayOfNulls<Drawable>(2)
      drr[0] = drawable.background
      drr[1] = drawable.foreground

      val layerDrawable = LayerDrawable(drr)
      bitmap = Bitmap.createBitmap(layerDrawable.intrinsicWidth,
          layerDrawable.intrinsicHeight, Bitmap.Config.ARGB_8888)

    } else {

      bitmap = if(drawable.intrinsicWidth <= 0 || drawable.intrinsicHeight <= 0) {
        Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888)
      } else {
        Bitmap.createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight, Bitmap.Config.ARGB_8888)
      }
    }

    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)
    return bitmap
  }

  fun convertBitmapToBase64(bitmap: Bitmap): String? {

    return try {

      val byteArrayOutputStream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.JPEG, 70, byteArrayOutputStream)
      val byteArray = byteArrayOutputStream.toByteArray()

      Base64.encodeToString(byteArray, Base64.NO_WRAP)

    } catch (e: Exception) {
      null
    }
  }

  fun convertDrawableToBase64(drawable: Drawable): String? {

    val bitDw = drawable as BitmapDrawable
    val bitmap = bitDw.bitmap

    return FileBase.getBase64Data(bitmap)
  }

  fun getAdvertiserId(context: Context): String? {

    val adInfo: AdvertisingIdClient.Info
    var advertising_id: String? = null

    try {
      val googleAPI = GoogleApiAvailability.getInstance()
      val result = googleAPI.isGooglePlayServicesAvailable(context)

      if (result == ConnectionResult.SUCCESS) {
        adInfo = AdvertisingIdClient.getAdvertisingIdInfo(context)
        if (!adInfo.isLimitAdTrackingEnabled) {
          advertising_id = adInfo.id
        }
      }

    } catch (e: IOException) {
      e.printStackTrace()
    } catch (e: GooglePlayServicesNotAvailableException) {
      e.printStackTrace()
    } catch (e: IllegalStateException) {
      e.printStackTrace()
    } catch (e: GooglePlayServicesRepairableException) {
      e.printStackTrace()
    }

    return advertising_id
  }

  fun hasNavBar(activity: Activity): Boolean {

    val resources = activity.resources
    val id = resources.getIdentifier("config_showNavigationBar",
        "bool", "android")
    return id > 0 && resources.getBoolean(id)
  }

  fun getNavBarHeight(activity: Activity): Int {

    val resources = activity.resources
    val resourceId = resources.getIdentifier("navigation_bar_height",
        "dimen", "android")
    return if (resourceId > 0) {
      resources.getDimensionPixelSize(resourceId)
    } else 0
  }

  fun dpToPx(context: Context, dp: Int): Int {

    val scale = context.resources.displayMetrics.density
    return Math.round(dp * scale)
  }

  fun pxToDp(px: Float, context: Context): Float {
    return px / (context.resources.displayMetrics.densityDpi.toFloat() / DisplayMetrics.DENSITY_DEFAULT)
  }

  fun calculate(pct1: Int, total: Int): Int {
    var pct = pct1
    if (pct < 0) {
      pct = pct * -1
      pct = total * pct / 100
      return pct * -1
    }
    return total * pct / 100
  }

  fun getScreenWidth(activity: Activity): Int {

    // getting screen size
    val displaymetrics = DisplayMetrics()
    activity.windowManager.defaultDisplay
        .getMetrics(displaymetrics)
    return displaymetrics.widthPixels
  }

  fun getScreenHeight(activity: Activity): Int {

    // getting screen size
    val displaymetrics = DisplayMetrics()
    activity.windowManager.defaultDisplay
        .getMetrics(displaymetrics)
    return displaymetrics.heightPixels
  }

  fun fromHtml(source: String): Spanned =

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
        Html.fromHtml(source, Html.FROM_HTML_MODE_LEGACY)

      else
        Html.fromHtml(source)



  @Throws(JSONException::class)
  fun jsonToBundle(data: JSONObject): Bundle {

    val bundle = Bundle()
    val itr = data.keys()

    while (itr.hasNext()) {
      val key = itr.next() as String
      val `val` = data.get(key)

      if (`val` is String) {
        bundle.putString(key, `val`)
      } else if (`val` is Int) {
        bundle.putInt(key, `val`)
      } else if (`val` is Double) {
        bundle.putDouble(key, `val`)
      } else if (`val` is Float) {
        bundle.putFloat(key, `val`)
      } else if (`val` is Number) {
        bundle.putLong(key, `val`.toLong())
      } else {
        Log.e(TAG, "Firebase log event: Invalid bundle key:value - " + `val`)
      }
    }
    return bundle
  }

  @Throws(JSONException::class)
  fun bundleToJson(bundle: Bundle): JSONObject {

    val `object` = JSONObject()
    for (key in bundle.keySet()) {
      `object`.put(key, bundle.get(key))
    }
    return `object`
  }

  fun getColor(context: Context, @ColorRes resId: Int): Int {

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      context.getColor(resId)
    } else {
      context.resources.getColor(resId)
    }
  }

  fun sendMail(activity: Activity, toAddr: String, subject: String?, body: String?) {

    val i = Intent(Intent.ACTION_SEND)
    i.type = "message/rfc822"
    Log.d(TAG, "toAddr: " + toAddr)

    if (toAddr != "") i.putExtra(Intent.EXTRA_EMAIL, arrayOf(toAddr))
    if (subject != null && subject != "") i.putExtra(Intent.EXTRA_SUBJECT, subject)
    if (body != null && body != "") i.putExtra(Intent.EXTRA_TEXT, body)

    try {
      val gmailPkg = "com.google.android.gm"
      if (isPackageInstalled(activity, gmailPkg)) {
        i.`package` = gmailPkg
        activity.startActivity(i)

      } else {
        activity.startActivity(Intent.createChooser(i, "Send mail..."))
      }

    } catch (ex: android.content.ActivityNotFoundException) {
      Toast.makeText(activity, "There are no email clients installed.", Toast.LENGTH_SHORT).show()
    }

  }

  fun isPackageInstalled(context: Context, pkgName: String): Boolean {

    val pm = context.packageManager

    try {
      pm.getPackageInfo(pkgName, PackageManager.GET_META_DATA)
    } catch (e: PackageManager.NameNotFoundException) {
      return false
    }

    return true
  }

  /**
   * This method compares one version with another and
   * tells whether version is greater, smaller or equal
   *
   * @param versionToCompare version to be compared
   * @param versionFromCompare version from above version is to be compared
   * @return 1 if greater, -1 if lesser & 0 if equal
   */
  fun compareVersions(versionToCompare: String?, versionFromCompare: String?): Int {

    Log.v(TAG, "Comparing versions: $versionToCompare and $versionFromCompare")
    val verMaxLength = 3

    asserT(versionToCompare != null && versionFromCompare != null, "either of the version is null while comparing")
    if (versionToCompare == versionFromCompare) return 0

    val versionToSplit = versionToCompare!!.split("\\.".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
    asserT(versionToSplit.size == verMaxLength, "version to compare is in wrong format: " + versionToCompare)

    val versionFromSplit = versionFromCompare!!.split("\\.".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
    asserT(versionFromSplit.size == verMaxLength, "version from compare is in wrong format: " + versionFromCompare)

    for (i in 0 until verMaxLength) {

      val verToNum = Integer.parseInt(versionToSplit[i])
      val verFromNum = Integer.parseInt(versionFromSplit[i])
      if (verToNum > verFromNum) return 1
      if (verToNum < verFromNum) return -1
    }

    // this condition will never reach as versions equal are checked very first
    return 0
  }

  fun getCircleBitmap(bitmap: Bitmap): Bitmap {

    val output = Bitmap.createBitmap(bitmap.width,
        bitmap.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)

    val color = Color.RED
    val paint = Paint()
    val rect = Rect(0, 0, bitmap.width, bitmap.height)
    val rectF = RectF(rect)

    paint.isAntiAlias = true
    canvas.drawARGB(0, 0, 0, 0)
    paint.color = color
    canvas.drawOval(rectF, paint)

    paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
    canvas.drawBitmap(bitmap, rect, rect, paint)

    bitmap.recycle()

    return output
  }

  fun asserT(b: Boolean, message: String) {

    if (b) return
    val assertionError = AssertionError(message)

    if (BaseApp.instance.isDebugApp) {
      throw assertionError

    } else {
      // todo: report code bug
      Log.e(TAG, assertionError.toString())
    }
  }

  private fun getDeviceInfo(context: Context): JSONObject {

    val deviceInfo  = JSONObject()

    deviceInfo.put("company", Build.MANUFACTURER)
    deviceInfo.put("model", Build.MODEL)
    deviceInfo.put("buildId", Build.ID)
    deviceInfo.put("fingerprint", Build.FINGERPRINT)
    deviceInfo.put("brand", Build.BRAND)
    deviceInfo.put("indName", Build.DEVICE)
    deviceInfo.put("prodName", Build.MODEL)
    deviceInfo.put("company", Build.MANUFACTURER)

    val hardwareInfo = JSONObject()
    hardwareInfo.put("board", Build.BOARD)
    hardwareInfo.put("name", Build.HARDWARE)

    val display = getDisplaySize(context)
    val sensors = ArrayList<String>()
    for (sensor in getSensorList(context)) {
      sensors.add(sensor.name + "|" + sensor.type)
    }

    hardwareInfo.put("display", display.first.toString() + "X" + display.second)
    hardwareInfo.put("battery", getBatteryCapacity(context))
    hardwareInfo.put("cpu", cpuInfo)
    hardwareInfo.put("sensors", JSONArray(listOf<List<String>>(sensors)))
    hardwareInfo.put("ram", ramInfo)
    deviceInfo.put("hardwareInfo", hardwareInfo)

    val buildInfo = JSONObject()
    buildInfo.put("bootloader", Build.BOOTLOADER)
    buildInfo.put("display", Build.DISPLAY)
    buildInfo.put("tags", Build.TAGS)
    buildInfo.put("time", Build.TIME)
    buildInfo.put("type", Build.TYPE)
    buildInfo.put("user", Build.USER)
    buildInfo.put("os", Build.VERSION.SDK_INT)
    buildInfo.put("abi", JSONArray(Arrays.asList(*Build.SUPPORTED_ABIS)))
    deviceInfo.put("buildInfo", buildInfo)

    return deviceInfo
  }


  fun checkIfPckgInstalled(pckg: String): Boolean {

    try {
      val appInfo = BaseApp.instance.packageManager.getApplicationInfo(pckg, PackageManager.GET_META_DATA)

      if (appInfo != null) {
        return appInfo.enabled
      }

    } catch (e: PackageManager.NameNotFoundException) {
      return false
    }

    return true
  }

}
