/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Sep 18 2019
   Author     : Siddharth Garg
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { MuBridge, 
         UserAgent, 
         State, 
         SDK_TYPE
       }                              from './mu-bridge'
import { MuWebBridge }                from './web-bridge'
import * as NATIVE                    from './native-constants'
import { Mubble }                     from '@mubble/core'
import { NgZone }                     from '@angular/core'
import { RunContextBrowser }          from '../../rc-browser'

export interface WebSessionInitData {
  version              : string
  mobileNo             : string
  authKey              : string
  businessLogoUrl      : string
  businessName         : string
  businessRegId       ?: string
  businessId          ?: string
  businessColorHex    ?: string
  isRunningInCordova  ?: boolean
}

enum RequestMessageId {
  REQUEST_SESSION = 'REQUEST_SESSION',
  DIRECT_LINK     = 'DIRECT_LINK',      // SDK to App 
  API_REQUEST     = 'API_REQUEST',      // SDK to App
}

interface WindowMessage {
  requestId   : number
  messageId   : string
  data       ?: Mubble.uObject<any>
}

export class MuSdkBridge extends MuBridge {

  initData          : WebSessionInitData
  private reqMap    : Mubble.uObject<CordovaAsyncRequest> = {}

  constructor(rc      : RunContextBrowser,
              ngZone  : NgZone) {
    super(rc, ngZone)
  }

  preInit() {

    if (window['webkit'] && window['webkit'].messageHandlers.sdkCordova) {
      this.userAgent  = UserAgent.IOS
      this.permObj    = NATIVE.IOS_PERM
      
    } else if (window['sdkCordova']) {
      this.userAgent  = UserAgent.ANDROID
      this.permObj    = NATIVE.ANDROID_PERM
      
    } else {
      this.userAgent  = UserAgent.BROWSER
      this.webBridge  = new MuWebBridge(this.rc)
      this.permObj    = NATIVE.BROWSER_PERM
    }
    
    this.runningInBrowser = this.userAgent === UserAgent.BROWSER
    this.state            = State.INITIALIZED
  }

  async init() {

    await super.init()
    this.initSdkType()

    window.onmessage  = this.onIframeMessage.bind(this)
  }

  private initSdkType() {

    this.sdkType = this.userAgent === UserAgent.BROWSER ? SDK_TYPE.WEB : SDK_TYPE.CORDOVA
  }

/*==============================================================================
                            MESSAGING 
==============================================================================*/

  async onIframeMessage(event : MessageEvent) {
    
    // const message = event.data as WindowMessage

    // const requestId = message.requestId,
    //       messageId = message.messageId,
    //       data      = message.data

    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
    //   `Came to process message ${requestId} ${messageId} ${data?JSON.stringify(data):''}`)

    // const rootComp = this.rc.uiRouter.getRoot()

    // switch (messageId) {

    //   case RequestMessageId.REQUEST_SESSION : 
    //     this.initData = <WebSessionInitData>data 
    //     await rootComp.initWebSession(requestId, this.initData)
    //     break

    //   case RequestMessageId.DIRECT_LINK :
    //     const directLink = data.directLink,
    //           dlParams   = data.dlParams
    //     await rootComp.handleDirectLink(requestId, directLink, dlParams)  
    //     break

    //   case RequestMessageId.API_REQUEST:
    //     const apiName   = data.apiName,
    //           apiParams = data.apiParams
    //     this.rc.isAssert() && this.rc.assert(this.rc.getName(this), apiName, 'Invalid API args')
    //     await rootComp.handleApiRequest(requestId, apiName, apiParams)
    //     break
  
    //   default:
    //     this.rc.isAssert() && this.rc.assert(this.rc.getName(this), `Invalid messageId: ${messageId}`)    
    // }
  }

  postMessage(requestId: number, messageId: string,
              code: string, data ?: Mubble.uObject<any>) {

    if (this.sdkType === SDK_TYPE.CORDOVA) {
      this.postMessageToCordova(requestId, messageId, code, data)
      return
    }

    if (window === parent) return  

    const response = { code, data },
          message  = { requestId, messageId, response}

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `postMessage from App ${JSON.stringify(message)}`)
    window.parent.postMessage(message, '*')
  }

  async onCordovaMessage(requestId: number, data ?: Mubble.uObject<any>) {

    // const rootComp = this.rc.uiRouter.getRoot()

    // this.initData = data.initData
    // rootComp.initCordovaSession(requestId, this.initData)
    
    // const invData     = data.invData,
    //       directLink  = invData.directLink,
    //       dlParams    = invData.dlParams

    // rootComp.handleDirectLink(requestId, directLink, dlParams)

    // const nar = new CordovaAsyncRequest(requestId)
    // this.reqMap[nar.requestId] = nar

    // await nar.promise
  }

  async postMessageToCordova(requestId: number, messageId: string,
                             code: string, data ?: Mubble.uObject<any>) {

    // const nar = this.reqMap[requestId]
    // if (!nar) {
    //   this.rc.isError() && this.rc.error(this.rc.getName(this), 
    //     'Request id', requestId, 'is missing in request map')
    //   return
    // }

    // delete this.reqMap[requestId]
    
    // const obj = { requestId, messageId, code, data }
    // nar.resolve(obj)
  }

  async onSdkSuccessResponse(requestId: number, data: object = null, 
                             closeApp: boolean = true) {
    
    // if (this.sdkType === SDK_TYPE.WEB || this.sdkType === SDK_TYPE.CORDOVA) {
    //   const obj : ActCompInterface = {
    //     code : ActCompInterfaceCode.SUCCESS,
    //     data : data
    //   }

    //   const rootComp = this.rc.uiRouter.getRoot()
    //   rootComp.onActionComplete(requestId, obj)
    //   return
    // }

    // super.onSdkSuccessResponse(requestId, data, closeApp)
  }

  async onSdkFailureResponse(requestId: number, data: object, uiError: object, 
                             closeApp: boolean = true) {

    // if (this.sdkType === SDK_TYPE.WEB || this.sdkType === SDK_TYPE.CORDOVA) {
    //   const obj : ActCompInterface = {
    //     code : ActCompInterfaceCode.FAILURE,
    //     data : uiError
    //   }

    //   const rootComp = <SdkRootComponent>this.rc.uiRouter.getRoot()
    //   rootComp.onActionComplete(requestId, obj)
    //   return
    // }

    // super.onSdkFailureResponse(requestId, data, uiError, closeApp)
  }
}

class CordovaAsyncRequest {
      
  promise         : Promise<object>
  resolve         : (object) => void
  reject          : () => void

  constructor(public requestId : number) {

    this.promise    = new Promise((resolve, reject) => {
      this.resolve  = resolve
      this.reject   = reject
    })
  }
}
