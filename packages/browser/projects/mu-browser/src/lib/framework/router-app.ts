/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat Apr 22 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { XmnRouterBrowser }                   from '../xmn'
import { WIRE_TYPE, 
         WireObject, 
         XmnError,
         LOG_LEVEL,
         CustomData,
         ConnectionInfo
       }                                      from '@mubble/core'
import { GcCategory, 
         GcKey, 
         SessionGC
       }                                      from './constants'
import { RunContextBrowser }                  from '../rc-browser'

export class MuRouterApp extends XmnRouterBrowser {

  private isSessionTimedout : boolean
  protected userLoggedIn    : boolean
  
  constructor(rc: RunContextBrowser, serverUrl: string, ci: ConnectionInfo, 
              pubKey : string, encIV:Uint8Array) {

    super(rc, serverUrl, ci, pubKey, encIV)
    
    rc.setupLogger(this, 'RouterApp', LOG_LEVEL.DEBUG)
  }

  getNetworkType(rc: RunContextBrowser): string {
    return rc.utils.getNetworkType(rc) 
  }

  getLocation(rc: RunContextBrowser): string {
    return rc.utils.getLocation(rc)
  }

  getMaxOpenSecs(): number {
    return 100
  }

  getCustomData(rc: RunContextBrowser) : CustomData {
    return {} as CustomData
  }

  canStrtLastReqTimer() {
    return this.userLoggedIn
  }

  runAlwaysAsSecure(rc: RunContextBrowser): boolean {
    return false
  }

  async getSessionTimeOutSecs(rc : RunContextBrowser) {
    const gcConfig  = await rc.gcConfigKeyVal.getConfig(GcCategory.Session, GcKey.GeneralConfig) as any,
          sessionGc = Object.assign({}, gcConfig) as SessionGC

    return rc.getGlobalLogLevel() === LOG_LEVEL.DEBUG ?  20000 : sessionGc.fgTimeoutSec
  }

  sessionTimedOut(rc : RunContextBrowser) {
    rc.isStatus() && rc.status(rc.getName(this), `session timed out.`)
    this.isSessionTimedout  = true
  }

  async updateCustomData(rc: RunContextBrowser, inp: CustomData) {

  }

  async prepareConnection(rc: RunContextBrowser) {

    if (rc.bridge.isRunningInBrowser()) super.prepareConnection(rc)
    else                            await rc.bridge.prepareConnection()
  }

/*==============================================================================
                            API CALLS
===============================================================================*/

  // Never throws
  async sendRequest(rc: RunContextBrowser, api: string, params: object, 
                    timeoutMS ?: number): Promise <object>  {

    if (!api || !params) throw new Error(`Invalid argument for sendRequest api: ${api} params: ${params}`)

    if (rc.utils.isNetworkUnhealthy(rc)) {
      const error = {
        errorCode : XmnError.NetworkNotPresent
      }

      return error
    }

    if (rc.bridge.isRunningInBrowser()) {

      if (this.isSessionTimedout) {
        location.reload()
      }

      const resp = await this.sendBrowserRequest(rc, api, params,timeoutMS)

      if (rc.utils.isOfTypeUiError(resp) && resp['errorCode'] === XmnError._ConnectionExpired) {
        return await this.sendRequest(rc, api, params)
      } else {
        return resp
      }
  
    } else {
      const resp = await rc.bridge.sendRouterRequest(api, params)
      if (resp.errorCode) {
        const error = {
          errorCode : resp.errorCode,
          errorMessage : resp.errorMessage
        }
        return error as any
      
      }
      if (resp.events) await this.handleCordovaRouterEvents(rc, resp.events)
      return resp.data
    }
  }

  // async startSession(rc: RunContextBrowser, reset: boolean): Promise<string> {

  //   return rc.bridge.isRunningInBrowser() 
  //     ? await this.startBrowserSession(rc) 
  //     : await this.startCordovaSession(rc, reset)
  // }


  // private async startBrowserSession(rc: RunContextBrowser): Promise<string> {

  //   const req : StartSession.params = {
  //     fcmId     : rc.bridge.getFcmId(), 
  //     adId      : rc.bridge.getAdId(),
  //     psuedoId  : rc.bridge.getPseudoId(),
  //     referrer  : rc.bridge.getReferrerParams()
  //   }

  //   const resp: StartSession.retval | UiError = await this.sendRequest(rc, 
  //       StartSession.name, req) as (StartSession.retval | UiError)
    
  //   if (rc.utils.isOfTypeUiError(resp)) throw new Error(resp.errorCode)

  //   await this.onNcInstanceId(rc, resp.clientId, resp.appSettings, resp.settingsMd5)
  //   return resp.navUrl
  // }

  // private async startCordovaSession(rc: RunContextBrowser, reset: boolean): Promise<string> {

  //   const resp = reset ? await rc.bridge.recreateSession() 
  //                      : await rc.bridge.getSessionInfo()

  //   if (resp.errorCode) {
  //     rc.isDebug() && rc.debug(rc.getName(this), `Got error in startCordovaSession`)
  //     throw new Error(resp.errorCode)
  //   }

  //   if (resp.events) await this.handleCordovaRouterEvents(rc, resp.events)

  //   const retval = resp.data as StartSession.retval
  //   await this.onNcInstanceId(rc, retval.clientId, retval.appSettings, retval.settingsMd5)
  //   return retval.navUrl
  // }

/*==============================================================================
                            EVENTS
===============================================================================*/

  public sendEvent(rc: RunContextBrowser, name: string, params: object, ephemeral: boolean) {

    if (!rc.bridge.isRunningInBrowser()) {
      rc.bridge.sendRouterEvent(name, params, ephemeral)
      return
    }

    if (ephemeral) {
      this.sendEphemeralEvent(rc, name, params)
    } else {
      this.sendPersistentEvent(rc, name, params)
    }
  }


/*==============================================================================
                            MEMBER FUNCTIONS
===============================================================================*/

  protected async handleCordovaRouterEvents(rc: RunContextBrowser ,events: Array<JSON>) {

    while(events.length) {
      const event = events.shift() as any as WireObject
      // Do not pass sys events to xmn-router-browser
      if (event.type === WIRE_TYPE.SYS_EVENT) {
        rc.isAssert() && rc.assert(rc.getName(this), `Platform should handle SysEvents on its own`)
      } else {
        await this.providerMessage(rc, [WireObject.getWireObject(event)])
      }
    }
  }


  protected async sendBrowserRequest(rc: RunContextBrowser, api: string, 
                                     params: object, timeoutMS ?: number): Promise <object> {
    
    return await super.sendRequest(rc, api, params, timeoutMS)
    .catch(err => {
        const error = {
          errorCode     : err.code || err.message,
          errorMessage  : err.message || ''
        }
        return error
      })
  }


}
