/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Jun 28 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

interface TimerList {
  
  nextTickAt: number
  cb: () => number
}

/**
 * tickAfter is coded to resemble setTimeout. Here are key differences:
 * 
 *  - If you call this function multiple times, it remembers the lowest time interval at which it should call. If you
 *    wish to override the last value, you should pass overwrite flag
 * 
 *  - The callback if returns a value, timer is rescheduled to tick after that much time. Returning a falsy value will
 *    automatically cancel your subscription
 * 
 *  - It provides as a efficient helper in managing the timer. You need not worry about memory leak, if your cb returns
 *    right value, depending on the situation. A remove function is provided, in case you cannot predict this behavior
 * 
 *  - One class can have 'n' timers for different purpose, without worrying about managing timer. You should have different
 *    callbacks in such cases
 */

export class Timer {

  private subscriptions: TimerList[] = []
  private cbTimer: () => void

  private currentTimer               = null
  private nextTs: number             = 0

  constructor() {
    this.cbTimer = this.timerEvent.bind(this)
  }

  /**
   * Subscribe to timer
   * @param cb Callback
   * @param ms milli-seconds to tick after
   * @param overwrite Overwrite the old subscription with this one. Read main comment
   */
   
  tickAfter(cb: () => number, ms: number, overwrite ?: boolean): void {

    const subs  = this.subscriptions,
          sub   = subs.find(s => s.cb === cb),
          now   = Date.now()

    let   nextTickAt = now + ms

    if (sub) {
      if (overwrite) {
        sub.nextTickAt = nextTickAt
      } else if (sub.nextTickAt > nextTickAt) {
        sub.nextTickAt = nextTickAt
      } else {
        nextTickAt = sub.nextTickAt
      }
    } else {
      subs.push({nextTickAt, cb})
    }

    if (this.nextTs > nextTickAt || !this.nextTs) {
      if (this.currentTimer) clearTimeout(this.currentTimer as any)
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any
      this.nextTs       = nextTickAt
    }
  }

  /**
   * Removes timer subscription. Read main comments to understand usage of this
   * @param cb 
   */
  remove(cb: () => number) {
    const index = lo.findIndex(this.subscriptions, {cb})
    if (index !== -1) {
      // We don't worry about the timer as it will manage itself in timer event
      this.subscriptions.splice(index, 1)
    }
  }

  private timerEvent() {

    const now   = Date.now(),
          subs  = this.subscriptions

    let   nextTickAt  = Number.MAX_SAFE_INTEGER,
         len   = subs.length

    for (let i = 0; i < len; i++) {

      const sub         = subs[i]
      let   thisTickAt  = sub.nextTickAt

      if (thisTickAt < now) { // time elapsed
        const thisNextTick = sub.cb()
        if (!thisNextTick || thisNextTick < 0) {
          this.subscriptions.splice(i--, 1)
          len--
          continue
        } else {
          thisTickAt = now + thisNextTick
        }
      }

      if (nextTickAt > thisTickAt) nextTickAt = thisTickAt
    }

    if (nextTickAt !== Number.MAX_SAFE_INTEGER) {
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any
      this.nextTs       = nextTickAt
    } else {
      this.currentTimer = null
      this.nextTs       = 0
    }
  }
}