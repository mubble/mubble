/*------------------------------------------------------------------------------
   About      : Transient screen level analytics data storage
   
   Created on : Sat Nov 03 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser }                            from '../../rc-browser'
import { DIRECTION }                                    from '../../ui'

export class AnalyticsScreenInfo {

  private invocationTs        : number
  private navMode             : string
  private modal               : boolean = false
  private eventData           : JSON = <JSON> { }

  constructor(private rc: RunContextBrowser, private screenName: string, 
      private invocationSource: string, navMode?: string, modal?: boolean) {

    rc.setupLogger(this, 'AnalyticsScreenInfo')

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'Creating new AnalyticsScreen State:', screenName, 'Invocation:', 
      invocationSource)
    
    this.invocationTs       = Date.now()
    this.navMode            = navMode !== undefined ? navMode : 'unknown'
    this.modal              = modal
  }

  getInvocationSource(): string { return this.invocationSource }

  getScreenName(): string { return this.screenName }
  
  onScreenDestroy() {

    let eventName               = this.modal ? 'mod_' : ''
    eventName                  += this.screenName + '_screen'
    this.eventData['from']      = this.invocationSource
    this.eventData['inv_ts']    = this.invocationTs,
    this.eventData['stay_time'] = Date.now() - this.invocationTs
    this.eventData['nav_mode']  = this.navMode

    this.rc.userEvent.logEvent(eventName, this.eventData)
  }

  setScreenState(stateName: string, stateValue: number | string) {
    this.eventData[stateName] = stateValue

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `Screen state: ${stateName}, value: ${stateValue}`)
  }

  setScreenAction(actionName: string) {
    
    if (this.eventData.hasOwnProperty(actionName)) {
      let count: number = this.eventData[actionName]
      this.eventData[actionName] = ++count
    } else {
      this.eventData[actionName] = 1
    }

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'Screen Action:', actionName, 'Count: ', this.eventData[actionName])
  }

  setScreenActionScroll(direction: DIRECTION) {

    switch(direction) {

      case DIRECTION.LEFT:
        this.eventData['scrollLeft'] = 1
        break

      case DIRECTION.UP:
        this.eventData['scrollUp'] = 1
        break
        
      case DIRECTION.RIGHT:
        this.eventData['scrollRight'] = 1
        break
        
      case DIRECTION.DOWN:
        this.eventData['scrollDown'] = 1
        break
    }

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Screen Scroll:', direction)
  }
}
