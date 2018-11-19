package util

import android.os.Handler
import android.os.Looper
import core.MubbleLogger
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
class AdhocTimer(timerName: String, callback: () -> Long): MubbleLogger {

  override val customTag   : String  = "Adhoc:$timerName"
  private  var scheduledAt : Long    = 0L
  private  val logging     : Boolean = false
  private  val looper      : Looper  = Looper.myLooper()
  private  val handler     : Handler = Handler(looper)

  private val runnable : Runnable = Runnable {

    check(looper === Looper.myLooper())

    scheduledAt = 0L          // Before we run the scheduled task, we mark the old schedule done
    val msAfter = callback()  // If callback has return next schedule time and it did not call tickAfter

    if (logging) info { "Callback returned $msAfter" }

    // We will honor the return value only when callback has not explicitly set the timer again
    if (scheduledAt == 0L) reSchedule(msAfter)
  }

  fun tickAfter(ms: Long, overwrite : Boolean = false) {

    if (logging) info { "Came to tickAfter $ms" }

    check(looper === Looper.myLooper())

    val newScheduledAt = System.currentTimeMillis() + ms

    // Already scheduled at a earlier time and not supposed to overwrite
    if (!overwrite && scheduledAt < newScheduledAt) return

    reSchedule(ms)
  }

  fun remove() {
    check(looper === Looper.myLooper())
    if (logging) info { "Came to remove" }
    reSchedule(0)
  }

  private fun reSchedule(ms: Long) {

    if (scheduledAt > 0L) handler.removeCallbacks(runnable)

    scheduledAt = if (ms > 0) {

      if (logging) info { "Rescheduled timer after ${ms/1000} sec. Removed old: ${scheduledAt != 0L}" }
      handler.postDelayed(runnable, ms)
      System.currentTimeMillis() + ms
    } else {
      if (logging) info { "Not rescheduling timer. Removed old: ${scheduledAt != 0L}" }
      0
    }

  }

}