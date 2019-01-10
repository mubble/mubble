/*------------------------------------------------------------------------------
   About      : Various utility functions

   Created on : 23/11/17
   Author     : Raghvendra Varma

   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

package util

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.inputmethod.InputMethodManager
import core.BaseApp
import org.jetbrains.anko.runOnUiThread
import org.json.JSONObject
import java.lang.reflect.Method
import java.text.SimpleDateFormat
import java.util.*


/*------------------------------------------------------------------------------

  J S O N    U T I L I T I E S

------------------------------------------------------------------------------*/
fun <T> JSONObject.toImmutableMap(cb: (key: String, jsonObject: JSONObject)->T): Map<String, T> {

  val map     = mutableMapOf<String, T>()
  val allKeys = keys()

  for (key in allKeys) {
    val obj = getJSONObject(key)
    map.put(key, cb(key, obj))
  }

  return map
}

fun <T> JSONObject.toImmutableList(cb: (key: String, jsonObject: JSONObject)->T): List<T> {

  val allKeys = keys()
  val list    = mutableListOf<T>()

  for (key in allKeys) {
    val obj = getJSONObject(key)
    list.add(cb(key, obj))
  }

  return list
}

/*------------------------------------------------------------------------------

  M U L T I    T H R E A D I N G I N G

------------------------------------------------------------------------------*/
fun <T> syncExecuteInMainThread(closure: ()->T? ): T? {

  if (Looper.myLooper() === Looper.getMainLooper()) return closure()

  var resp: T?  = null
  val lock      = java.lang.Object()
  var obtained  = false

  BaseApp.instance.runOnUiThread {
    synchronized(lock) {
      resp     = closure()
      obtained = true
      lock.notify()
    }
  }

  synchronized(lock) {
    if (obtained) return resp
    lock.wait()
    return resp
  }
}

fun asyncExecuteInMainThread(closure: ()->Unit) {

  Handler(Looper.getMainLooper()).post {
    closure()
  }

}

/*------------------------------------------------------------------------------

  E X T R A     U T I L I T I E S

------------------------------------------------------------------------------*/

object UtilBase {

  fun sanitizeMobileNo(mobileNo: String?): String? {

    var mobNo = mobileNo

    if (mobNo.isNullOrBlank()) return null

    if (mobNo.startsWith("+91")) return mobNo

    if (mobNo.startsWith("0")) {
      mobNo = mobNo.substring(1)

      if (mobNo.startsWith("0")) {
        return "+" + mobNo.substring(1)
      } else if (mobNo.length == 10) {
        return "+91$mobNo"
      } else {
        return "0$mobNo"
      }
    } else if (mobNo.length == 10) {
      return "+91$mobNo"
    }

    return mobNo
  }

  fun copyToClipBoard(activity: Activity, textToCopy: String) {

    val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("Share", textToCopy)
    clipboard.primaryClip = clip
  }

  fun openSoftInputKeyboard() {

    val inputMethodManager = BaseApp.instance.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    inputMethodManager.toggleSoftInput(InputMethodManager.SHOW_FORCED, 0)
  }

  fun hideSoftInputKeyboard(activity: Activity) {

    val inputMethodManager = BaseApp.instance.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    val view = activity.currentFocus
    inputMethodManager.hideSoftInputFromWindow(view!!.windowToken, 0)
  }

  fun toTimeString(ms: Long): String {

    val date = Date(ms)
    val sdf = SimpleDateFormat("HH:mm:ss.SSS", Locale.UK)
    return sdf.format(date)
  }

}

/*------------------------------------------------------------------------------

  U R E F L E C T     U T I L I T I E S

------------------------------------------------------------------------------*/

object UReflect {

  /**
   * This method looks for the method in given class and all its parent classes
   * and makes it accessible if its not.
   *
   * @param c Class in which method has to be dig.
   * @param methodName Exact ConnName of the method.
   * @param args Class of the args that the method accepts
   *
   * @return Method object if the method is found in case of any exception returns
   * null.
   */
  fun getMethod(c: Class<*>?, methodName: String?,
                vararg args: Class<*>): Method? {
    var c = c

    if (c == null || methodName == null || methodName.isEmpty()) return null
    var method: Method? = null
    while (method == null && c != null) {
      try {
        method = c.getDeclaredMethod(methodName, *args)
      } catch (e: NoSuchMethodException) {
      }

      c = c.superclass
    }

    if (method != null && !method.isAccessible) method.isAccessible = true
    return method
  }

  /**
   * This will execute the method object on the object passed and returns the
   * result after casting into the expected type.
   *
   * @param m Method object that has to be executed
   * @param o Object on which the execution has to be made.
   * @param args Args that the method will accept(in order).
   * @param <T> Expected type in which the result is expected.
   *
   * @return The result that comes after executing and cast into Type T. In case
   * of cast failure, null args or any other exception it throws.
  </T> */
  fun <T> executeDontReport(m: Method?, o: Any?,
                            vararg args: Any): T? {
    try {
      return executeOrThrow<T>(m, o, *args)
    } catch (e: Throwable) {
      e.printStackTrace()
      return null
    }

  }

  /**
   * This will execute the method object on the object passed and returns the
   * result after casting into the expected type.
   *
   * @param m Method object that has to be executed
   * @param o Object on which the execution has to be made.
   * @param args Args that the method will accept(in order).
   * @param <T> Expected type in which the result is expected.
   *
   * @return The result that comes after executing and cast into Type T. In case
   * of cast failure, null args or any other exception it throws.
  </T> */
  fun <T> executeOrThrow(m: Method?, o: Any?,
                         vararg args: Any): T {
    try {
      if (m == null) throw IllegalArgumentException("Method is null")
      if (!m.isAccessible) m.isAccessible = true
      val result = m.invoke(o, *args)
      return result as T
    } catch (e: Throwable) {
      throw IllegalStateException(e)
    }

  }

}
