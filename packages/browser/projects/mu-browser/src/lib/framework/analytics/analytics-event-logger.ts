/*------------------------------------------------------------------------------
   About      : Analytics event logger / data bridge with native.
   
   Created on : Tue Jul 25 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import { EventSystem, 
         EVENT_PREFIX 
       }                                              from '../../util'
import { ANALYTICS_EVENT, 
         ANALYTICS_EVENT_PARAMS 
       }                                              from './analytics-event'
import { RunContextBrowser }                          from '../../rc-browser'

const _EVENT_PREFIX = EVENT_PREFIX + '-'

const MAX_LOG_NAME_SIZE   = 32
const MAX_KEY_NAME_SIZE   = 24
const MAX_VALUE_NAME_SIZE = 36

const USER_PROPERTIES = {
  USER_LINK_ID        : 'user_link_id',
  EMAIL_ID            : 'email_id',
  APP_LANG            : 'app_lng'
}

export class AnalyticsEventLogger {

  private allowLogging  : boolean

  constructor(protected rc: RunContextBrowser) {

    this.allowLogging = false
    if (this.rc.userKeyVal.clientId) this.initLogging()
  }

  initLogging() {

    this.allowLogging = true
      
    this.setUserId(this.rc.userKeyVal.clientId)
    this.setAllUserProperties()
    this.sendSessionEvents()
    
    // EventSystem.subscribeAll([
    //   APP_UI_EVENT.UPDATE_USER_EMAIL] , this.handleEvent.bind(this))
  }

  private handleEvent(eventName: string) {

    switch(eventName) {

      // case _EVENT_PREFIX + APP_UI_EVENT.UPDATE_USER_EMAIL:
      //   this.setUserProperty(USER_PROPERTIES.EMAIL_ID, this.rc.userKeyVal.emailId)
      //   break
    }
  }

  private setAllUserProperties() {
    

    if (this.rc.userKeyVal.userLinkId) {
      this.setUserProperty(USER_PROPERTIES.USER_LINK_ID, this.rc.userKeyVal.userLinkId)
      // this.setUserProperty(USER_PROPERTIES.EMAIL_ID, this.rc.userKeyVal.emailId)
    }
  }

  private sendSessionEvents() {
    // Sending app launch session event
    this.logEvent(ANALYTICS_EVENT.APP_LAUNCH, null)
  }

  private setUserId(userId: number) {

    if (!this.allowLogging || !userId) return
    
    this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'Firebase userId: ', userId)  
    this.rc.bridge.setUserId(userId)
  }

  private setUserProperty(propName: string, value: string) {
    
    if (!this.allowLogging) return

    const valid: boolean = propName != null && propName.length > 0 && 
        propName.length <= MAX_KEY_NAME_SIZE && value != null && 
        value.length > 0 && value.length <= MAX_VALUE_NAME_SIZE

    if (!valid) {
      this.rc.isWarn() && this.rc.warn('NcFirebase', 
        'Invalid Firebase User Property:', propName, value)
      return
    }

    this.rc.isStatus() && this.rc.status(this.rc.getName(this), 
      'Firebase userProperty:: Name: ', propName, 'Value: ', value)
      this.rc.bridge.setUserProperty(propName, value)
  }

  logAppShare(routeName: string, sharePkg: string) {

    const eventData: JSON = <JSON>{}
    eventData[ANALYTICS_EVENT_PARAMS.SCREEN]    = routeName
    this.logEvent(ANALYTICS_EVENT.APP_SHARE, eventData)
  }

  logEvent(eventName: string, eventData: object) {

    if (!this.allowLogging) {
      this.rc.isStatus() && this.rc.status(this.rc.getName(this), 
        'Cannot send Firebase event, Allow logging false')
      return
    }

    this.logPublicEvent(eventName, eventData)
  }

  logPublicEvent(eventName: string, eventData: object) {

    if (eventName == null || eventName.length === 0 || eventName.length >= MAX_LOG_NAME_SIZE) {
      this.rc.isWarn() && this.rc.warn('NcFirebase', 
        'Firebase eventName invalid: empty OR length > 32 characters, exiting...')
      return
    }

    eventData = this.checkNValidateBundle(eventData)

    this.rc.isStatus() && this.rc.status('NcFirebase', 
      'Logging Firebase event:', eventName, JSON.stringify(eventData))
      this.rc.bridge.logEvent(eventName, JSON.stringify(eventData))
  }

  private checkNValidateBundle(bundle: object): JSON {

    if (bundle === null) return <JSON>{}

    let eventData = <JSON>{}
    
    for (let key in bundle) {
      const val              : any      = bundle[key]
      const inValidKey       : boolean  = key !== this.validKey(key)
      const inValidValue     : boolean  = typeof(val) === 'string' && val !== this.validStringValue(String(val))
      const inValidValueType : boolean  = !(typeof(val) === 'string' || typeof(val) === 'number') 

      if (inValidKey || inValidValue || inValidValueType) {
        const objVal = inValidKey ? key : String(val);
        this.rc.isWarn() && this.rc.warn('NcFirebase', 
          'Invalid key : value pair inside event:', objVal, inValidValue, inValidValueType)
      } else {
        eventData[key] = bundle[key]
      }
    }
    return eventData
  }

  private validKey(key: string): string {

    if (key.length > 0 && key.length <= MAX_KEY_NAME_SIZE) return key
    this.rc.isWarn() && this.rc.warn('NcFirebase', 
      'FireBase Key length is 0 || > 24 Characters...')
    return key.substring(0, MAX_KEY_NAME_SIZE)
  }

  private validStringValue(value: string): string {

    if (value.length > 0 && value.length <= MAX_VALUE_NAME_SIZE) return value;
    this.rc.isWarn() && this.rc.warn('NcFirebase', 
      'FireBase Value length is 0 || > 36 Characters...')
    return value.substring(0, MAX_VALUE_NAME_SIZE);
  }

}