/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Jun 28 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

export class TimerInstance {

  nextTickAt  : number
  
  // The callback should return ms to tick after (not the absolute time)
  constructor(private timer: Timer, public name: string, public cb: () => number) {
  }

  tickAfter(ms: number, overwrite ?: boolean) {
    return this.timer._tickAfter(this, ms, overwrite)
  }

  remove() {
    return this.timer._remove(this)
  }
}


/**
 * Timer tickAfter is coded to resemble setTimeout. Here are key differences:
 * 
 *  - If you call tickAfter function multiple times, it remembers the lowest time interval at which it should callback.
 *    If you wish to override the stored value, you should pass overwrite flag
 * 
 *  - When the chosen time arrives, your callback is called. However, callback processing is special as noted below.
 * 
 *  - Callbacks are unique and you are allowed to register only one timer per callback function
 * 
 *  - The callback if returns a value, timer is rescheduled to tick after that much time. Returning a 0 will
 *    automatically cancel your subscription. If during the callback processing there is a call to tickAfter/remove
 *    return value is ignored
 * 
 *  - It provides as a efficient helper in managing the timer. You need not worry about memory leak, if your cb returns
 *    right value, depending on the situation. A remove function is provided, in case you never return a zero in 
 *    your callback
 * 
 *  - One class can have 'n' timers for different purpose, without worrying about managing timer. You should have different
 *    callbacks in such cases
 */

export class Timer {

  private subscriptions: TimerInstance[] = []
  private cbTimer: () => void

  private currentTimer               = null
  private nextTs: number             = 0
  private logging                    = true

  constructor() {
    this.cbTimer = this.timerEvent.bind(this)
  }

  public register(name: string, cb: () => number): TimerInstance {

    const subs        = this.subscriptions,
          sub         = subs.find(s => s.cb === cb)
    
    if (sub) return sub // only one timer allowed per callback
    return new TimerInstance(this, name, cb)
  }

  /**
   * Subscribe to timer
   * @param cb Callback
   * @param ms milli-seconds to tick after
   * @param overwrite Overwrite the old subscription with this one. Read main comment
   */
  _tickAfter(sub: TimerInstance, ms: number, overwrite ?: boolean): void {

    const subs        = this.subscriptions,
          now         = Date.now()

    let   nextTickAt  = now + ms,
          index       = subs.indexOf(sub)

    if (index !== -1) { // already subscribed
      if (overwrite || sub.nextTickAt >= nextTickAt || sub.nextTickAt <= now) {
        sub.nextTickAt = nextTickAt
        this.logging && console.info(`${sub.name}:tickAfter modified ${
          ms} ms overwrite:${overwrite} for supplied value`)
      } else {
        nextTickAt = sub.nextTickAt
        this.logging && console.info(`${sub.name}:tickAfter ignoring after ${
          ms} as old value is lower`)
      }
    } else { // not subscribed
      sub.nextTickAt = nextTickAt
      subs.push(sub)
      this.logging && console.info(`${sub.name}:tickAfter inserted after ${ms}`)
    }

    if (this.nextTs > nextTickAt || !this.nextTs) {
      if (this.currentTimer) clearTimeout(this.currentTimer as any)
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any
      this.nextTs       = nextTickAt
      this.logging && console.info(`${sub.name}:tickAfter timer scheduled after ${
        nextTickAt - now} ms length:${subs.length}`)
    }
  }

  /**
   * Removes timer subscription. Read main comments to understand usage of this
   * @param cb 
   */
  _remove(sub: TimerInstance) {
    const index = this.subscriptions.indexOf(sub)
    if (index !== -1) {
      // We don't worry about the timeout call on timer as it managed in timeout
      const [sub] = this.subscriptions.splice(index, 1)
      this.logging && console.info(`${sub.name}:removed timer length:${this.subscriptions.length}`)
    }
  }

  private timerEvent() {

    const now   = Date.now(),
          subs  = this.subscriptions

    let   nextTickAt  = Number.MAX_SAFE_INTEGER,
          selectedSub

    for (let i = 0; i < subs.length; i++) {

      const sub         = subs[i]
      let   thisTickAt  = sub.nextTickAt

      if (thisTickAt <= now) { // time elapsed

        const thisNextTick = sub.cb(),
              updatedSub   = subs[i]

        if (updatedSub !== sub) { // During timeout timer was removed via remove() call
          i--
          continue
        } else if (thisTickAt !== updatedSub.nextTickAt) { // timeout got modified via tickAfter() during the callback, ignore return value
          thisTickAt = updatedSub.nextTickAt
        } else if (!thisNextTick || thisNextTick < 0) { // The return value says cancel the timer
          this.logging && console.info(`${sub.name}:timerEvent removed subscription based on callback return value`)
          this.subscriptions.splice(i--, 1)
          continue
        } else { // Next tick is set via the return value of callback
          this.logging && console.info(`${sub.name}:timerEvent will be re-scheduled after ${thisNextTick}`)
          thisTickAt = now + thisNextTick
        }
      }

      if (nextTickAt > thisTickAt) {
        nextTickAt  = thisTickAt
        selectedSub = sub
      }
    }

    if (selectedSub) { // Next timer to schedule based on selectedSub tick time
      this.currentTimer = setTimeout(this.cbTimer, nextTickAt - now) as any

      this.nextTs       = nextTickAt
      this.logging && console.info(`${selectedSub.name}:timerEvent timer scheduled after ${
        nextTickAt - now} ms number of timers:${subs.length}`)
    } else {
      this.currentTimer = null
      this.nextTs       = 0
      this.logging && console.info(`Timer:timerEvent removed all timers. Assert zeros subs: ${subs.length} === 0`)
    }
  }
}