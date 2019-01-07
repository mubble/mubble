package core

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Point
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.view.WindowManager
import android.view.inputmethod.InputMethodInfo
import android.view.inputmethod.InputMethodManager
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import util.AndroidBase.readTextFile
import java.io.IOException
import java.io.RandomAccessFile
import java.util.*
import java.util.regex.Pattern

/**
 * Created by
 * siddharthgarg on 18/01/18.
 */

object DeviceInfo {

  fun getData(): JSONObject {

    val json = JSONObject()

    try {

      val pInfo = BaseApp.instance.packageManager.getPackageInfo(BaseApp.instance.packageName, 0)
      json.put("appVersion", pInfo.versionName)

      // Get emails
      val emails = JSONArray()
      json.put("emails", emails)
      val accounts = AccountManager.get(BaseApp.instance)
          .getAccountsByType("com.google")
      for (account in accounts) {
        emails.put(account.name)
      }

      json.put("deviceDisplayLang", Locale.getDefault().displayLanguage)

      // Get device Info
      val deviceInfo = JSONObject()
      deviceInfo.put("company", Build.MANUFACTURER)
      deviceInfo.put("model", Build.MODEL)
      deviceInfo.put("buildId", Build.ID)
      deviceInfo.put("fingerprint", Build.FINGERPRINT)
      deviceInfo.put("brand", Build.BRAND)
      deviceInfo.put("indName", Build.DEVICE)
      deviceInfo.put("prodName", Build.MODEL)
      deviceInfo.put("company", Build.MANUFACTURER)
      deviceInfo.put("languageInfo", getLanguageInfo())

      deviceInfo.put("installPackages", getInstallPackages())

      val hardwareInfo = JSONObject()
      hardwareInfo.put("board", Build.BOARD)
      hardwareInfo.put("name", Build.HARDWARE)
      hardwareInfo.put("display", getDisplaySize(BaseApp.instance))
      hardwareInfo.put("battery", getBatteryCapacity(BaseApp.instance))
      hardwareInfo.put("cpu", getCpuInfo())
      hardwareInfo.put("ram", getRamInfo())

      deviceInfo.put("hardwareInfo", hardwareInfo)

      val buildInfo = JSONObject()
      buildInfo.put("bootloader", Build.BOOTLOADER)
      buildInfo.put("display", Build.DISPLAY)
      buildInfo.put("tags", Build.TAGS)
      buildInfo.put("time", Build.TIME)
      buildInfo.put("type", Build.TYPE)
      buildInfo.put("user", Build.USER)
      buildInfo.put("os", Build.VERSION.SDK_INT)

      val abis: Array<String> = Build.SUPPORTED_ABIS
      buildInfo.put("abi", JSONArray(Arrays.asList(abis)))
      deviceInfo.put("buildInfo", buildInfo)

      json.put("deviceInfo", deviceInfo)
    } catch (e: JSONException) {
      e.printStackTrace()
    } catch (e: PackageManager.NameNotFoundException) {
      e.printStackTrace()
    }

    return json
  }

  private fun getDisplaySize(context: Context): String {

    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val display = wm.defaultDisplay
    val size = Point()
    display.getSize(size)

    return "" + size.y + "X" + size.x
  }

  private fun getSensorList(context: Context): List<Sensor> {

    val smm = context.getSystemService(
        Context.SENSOR_SERVICE) as SensorManager
    return smm.getSensorList(Sensor.TYPE_ALL)
  }

  private fun getCpuInfo(): String {

    return try {
      readTextFile("/proc/cpuinfo")
    } catch (e: Exception) {
      "unknown"
    }
  }

  private fun getLanguageInfo(): JSONObject {

    val inputMgr = BaseApp.instance.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    val imiList: List<InputMethodInfo> = inputMgr.inputMethodList
    val imiEnabledList: List<InputMethodInfo> = inputMgr.enabledInputMethodList

    val langInfo = JSONObject()

    imiList.forEach {
      langInfo.put(it.packageName, imiEnabledList.contains(it))
    }

    return langInfo
  }

  private fun getRamInfo(): String {

    val reader: RandomAccessFile
    val load: String

    try {
      reader = RandomAccessFile("/proc/meminfo", "r")
      load = reader.readLine()

      // Get the Number value from the string
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

  @SuppressLint("PrivateApi")
  private fun getBatteryCapacity(context: Context): String {

    val powerProfileClass = "com.android.internal.os.PowerProfile"
    return try {
      val powerProfile = Class.forName(powerProfileClass)
          .getConstructor(Context::class.java).newInstance(context)

      Class.forName(powerProfileClass)
          .getMethod("getBatteryCapacity")
          .invoke(powerProfile).toString() + "mAh"

    } catch (e: Throwable) {
      "unknown"
    }
  }

  private fun getInstallPackages(): JSONArray {

    val insPckgs = JSONArray()

    BaseApp.instance.packageManager.getInstalledPackages(PackageManager.GET_META_DATA)
        .map { it.packageName }
        .forEach { insPckgs.put(it) }

    return insPckgs
  }

}
