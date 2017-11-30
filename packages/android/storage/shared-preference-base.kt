/*------------------------------------------------------------------------------
   About      : Base class for Using SharedPreferences as Key-value pairs

   Created on : 23/11/17
   Author     : Raghvendra Varma

   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

package `in`.mubble.android.storage

import `in`.mubble.android.core.App
import android.content.Context
import android.content.SharedPreferences
import android.os.Looper
import org.jetbrains.anko.AnkoLogger
import org.jetbrains.anko.info
import org.jetbrains.anko.warn
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

/*------------------------------------------------------------------------------

  SharedPreferenceBase provides a base class to persisted name-value pairs
  in shared-preferences.

  SharedPreferences should be at module level. All Ui preferences should be in a
  single SharedPreference

  Once instantiated, object is assumed to be accessed from same thread,
  if you use it from some other thread, it will give throw exception

  The extending class must set all the keys to their default values at the time
  of construction (init). This is a way of stating:
    - The default values, field name and types
    - A convenient way of declaring name=value pairs that are currently in use

  The last line in init, you must call commitDefaults(). This takes care of evicting
  unused keys from the shared-preference.

  TODO: Not provided as of now (To be done on first need)

  - Set of Strings as a data type
  - Ability to have batch mode for saving preferences
  - Registry of all shared-preferences, so that they can be cleaned on module removal

------------------------------------------------------------------------------*/

abstract class SharedPreferenceBase(spName: String): AnkoLogger {

  companion object {
    private val prefNames = mutableSetOf<String>()
    private val lock = java.lang.Object()
  }

  protected fun <T> bindPreference(): PreferenceLoader<T> = PreferenceLoader()

  private val spInstance: SharedPreferences = App.instance.getSharedPreferences(spName,
  Context.MODE_PRIVATE)

  // Remember the creating thread. Only creating thread is allowed to access the preferences
  private val creatorThread = Looper.myLooper()

  // Initial map is used to identify the properties that are deleted on initial load
  private var initMap: MutableMap<String, Any>? = mutableMapOf<String, Any>()

  // Map of name-value pairs saved in the preferences
  private val valueMap = mutableMapOf<String, Any>()

  init {

    // Ensure there is only one object for each shared preference file
    assert(spName != "")

    synchronized(lock) {
      assert(prefNames.contains(spName) === false)
      prefNames.add(spName)
    }

    val all: MutableMap<String, *> = spInstance.all

    for (kv in all) {
      val key = kv.key
      val value = kv.value
      info { "Init:=> Loaded key: $key, value: $value" }
      if (value != null) initMap!![key] = value
    }
  }

  protected fun commitDefaults() {

    assert(creatorThread === Looper.myLooper())
    assert(initMap !== null)

    if (initMap!!.size !== 0) {

      val editor = spInstance.edit()
      for (kv in initMap!!) {
        val key = kv.key
        warn { "commitDefaults. Removing unused key: $key" }
        editor.remove(key)
      }
      editor.commit()
    }

    initMap = null
  }


  private class PreferenceDelegate<T> : ReadWriteProperty<SharedPreferenceBase, T>, AnkoLogger {

    override fun getValue(thisRef: SharedPreferenceBase, property: KProperty<*>): T {

      val key = property.name
      val value = thisRef.valueMap[key]

      assert(thisRef.creatorThread === Looper.myLooper(), {
        "Shared preferences can only be accessed from the thread that created it"
      })
      assert(thisRef.initMap === null, {
        "You must call commitDefaults before accessing values from the sharedPreference"
      })
      assert(value !== null, {
        "You forgot to provide the default value for ${property.name} before commitDefaults"
      })

      info { "getValue:=> $key is $value" }
      @Suppress("UNCHECKED_CAST") return value as T

//  private inline fun <reified T> getDefaultValue(): T =
//
//    when (T::class) {
//      Boolean::class  -> false as T
//      Float::class    -> 0.0f as T
//      Int::class      -> 0 as T
//      String::class   -> "" as T
//      else            -> wtf("${T::class}") as T
//    }
    }

    override fun setValue(thisRef: SharedPreferenceBase, property: KProperty<*>, value: T) {

      assert(thisRef.creatorThread === Looper.myLooper())
      assert(value !== null)

      val key = property.name

      if (thisRef.initMap === null /* commitDefaults done */) {

        // TODO: This will not work for MutableSet
        if (value == thisRef.valueMap[key]) {
          info { "setValue:=> Skipping as value has not changed $key=$value" }
          return
        }

        val editor = thisRef.spInstance.edit()
        when (value) {
          is String -> editor.putString(key, value)
          is Int -> editor.putInt(key, value)
          is Float -> editor.putFloat(key, value)
          is Boolean -> editor.putBoolean(key, value)
        // is MutableSet<*>  -> editor.putStringSet  (key, value as MutableSet<String>)
          else -> assert(false, {
            "setValue:=> Invalid value for $key as $value"
          })
        }
        editor.commit()

        thisRef.valueMap[key] = value as Any
        info { "setValue:=> updated $key=$value" }

      } else {

        val oldValue = thisRef.initMap!!.remove(key)
        val initValue: T = if (oldValue !== null) {
          if (oldValue::class !== (value as Any)::class) {
            warn { "setValue:=> type of $key has changed from ${oldValue::class} to ${(value as Any)::class}. Will be set to default value" }
            value
          } else {
            oldValue as T
          }
        } else {
          value
        }

        thisRef.valueMap[key] = initValue as Any
        info { "setValue:=> initialized $key=$initValue" }
      }

    }
  }

  protected class PreferenceLoader<T>() {

    operator fun provideDelegate(
    thisRef: SharedPreferenceBase,
    prop: KProperty<*>
    ): ReadWriteProperty<SharedPreferenceBase, T> {

      return PreferenceDelegate()
    }

  }

}