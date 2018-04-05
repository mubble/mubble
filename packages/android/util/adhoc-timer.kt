package `in`.mubble.android.util

import `in`.mubble.android.core.MubbleLogger
import android.os.Handler
import android.os.Looper
import org.jetbrains.anko.info

/*------------------------------------------------------------------------------
   About      : A long lifespan (typically tied to a class lifetime) adHoc timer.

   Created on : 17/01/18
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.

--------------------------------------------------------------------------------

This class is not thread safe and is not intended to be. It is used as a timer helper
and is always called from the thread that created it

TODO ????
  Test looper after the thread exits

------------------------------------------------------------------------------*/
/**
 *
 * @param
 * timerName : name of the timer, used for logging
 * callback  : callback function, returns re-run after ms (0 stops the timer)
 */
class AdhocTimer (timerName : String, callback  : () -> Long) : MubbleLogger {

  override val customTag: String = "$timerName:AdhocTimer"
  private var scheduledAt: Long = 0L

  private val looper    : Looper = Looper.myLooper()
  private val runnable: Runnable = Runnable {

    // Before we run the scheduled task, we mark the old schedule done
    scheduledAt = 0L

    // If callback has return next schedule time and it did not call tickAfter
    val msAfter = callback()

    info { "Callback returned $msAfter" }
    if (msAfter != 0L && scheduledAt == 0L) reSchedule(msAfter)
  }

  fun tickAfter(ms: Long, overwrite : Boolean = false) {

    check(looper === Looper.myLooper())

    // Already scheduled and not supposed to overwrite
    if (!overwrite && scheduledAt > 0L) return
    reSchedule(ms)
  }

  fun remove() {
    check(looper === Looper.myLooper())
    reSchedule(0)
  }

  private fun reSchedule(ms: Long) {

    val handler = Handler(looper)
    if (scheduledAt > 0L) handler.removeCallbacks(runnable)

    scheduledAt = if (ms > 0) {

      val now   = System.currentTimeMillis()
      handler.postDelayed(runnable, ms)
      now + ms

    } else {
      0
    }
  }


}