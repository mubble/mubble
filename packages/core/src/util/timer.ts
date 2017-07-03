/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Jun 28 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

interface TimerList {
  name        : string
  nextTickAt  : number
  cb          : () => number
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
  private logging                    = false

  constructor() {
    this.cbTimer = this.timerEvent.bind(this)
  }

  /**
   * Subscribe to timer
   * @param cb Callback
   * @param ms milli-seconds to tick after
   * @param overwrite Overwrite the old subscription with this one. Read main comment
   */
   
  tickAfter(name: string, cb: () => number, ms: number, overwrite ?: boolean): void {

    const subs        = this.subscriptions,
          now         = Date.now()

    let   nextTickAt  = now + ms,
          sub         = subs.find(s => s.cb === cb)

    if (sub) {
      if (overwrite || sub.nextTickAt >= nextTickAt || sub.nextTickAt <= now) {
        sub.nextTickAt = nextTickAt
        this.logging && console.log(`Timer:tickAfter modified ${sub.name} with ${
          ms} ms overwrite:${overwrite} for supplied value`)
      } else {
        nextTickAt = sub.nextTickAt
        this.logging && console.log(`Timer:tickAfter ignoring ${sub.name} after ${
          ms} as old value is lower`)
      }
    } else {
      sub = {name, nextTickAt, cb}
      subs.push(sub)
      this.logging && console.log(`Timer:tickAfter inserted ${sub.name} for ${ms}`)
    }

    if (this.nextTs > nextTickAt || !this.nextTs) {
      if (this.currentTimer) clearTimeout(this.currentTimer as any)
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any
      this.nextTs       = nextTickAt
      this.logging && console.log(`Timer:tickAfter timer scheduled after ${
        nextTickAt - now} ms length:${subs.length} for ${sub.name}`)
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
      const [sub] = this.subscriptions.splice(index, 1)
      this.logging && console.log(`Timer:removed timer ${sub.name} length:${this.subscriptions.length}`)
    } else {
      this.logging && console.log(`Timer:failed to remove timer ${cb.name} length:${this.subscriptions.length}`)
    }
  }

  private timerEvent() {

    const now   = Date.now(),
          subs  = this.subscriptions

    let   nextTickAt  = Number.MAX_SAFE_INTEGER,
          selected

    for (let i = 0; i < subs.length; i++) {

      const sub         = subs[i]
      let   thisTickAt  = sub.nextTickAt

      if (thisTickAt <= now) { // time elapsed
        const thisNextTick = sub.cb()
        this.logging && console.log(`Timer:timerEvent called ${sub.name} response:${thisNextTick}`)
        
        if (!thisNextTick || thisNextTick < 0) {
          this.subscriptions.splice(i--, 1)
          continue
        } else {
          thisTickAt = now + thisNextTick
        }
      }

      if (nextTickAt > thisTickAt) {
        nextTickAt = thisTickAt
        selected   = sub.name
      }
    }

    if (nextTickAt !== Number.MAX_SAFE_INTEGER) {
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any

      this.nextTs       = nextTickAt
      this.logging && console.log(`Timer:timerEvent timer scheduled after ${
        nextTickAt - now} ms length:${subs.length} for ${selected}`)
    } else {
      this.currentTimer = null
      this.nextTs       = 0
      this.logging && console.log(`Timer:timerEvent removed timer`)
    }
  }
}