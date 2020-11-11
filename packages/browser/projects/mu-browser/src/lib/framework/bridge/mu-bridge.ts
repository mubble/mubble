/*------------------------------------------------------------------------------
   About      : Class to bridge with native platform
   
   Created on : Fri Nov 02 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble, 
         NetworkType, 
         WireObject, 
         LOG_LEVEL,
         CustomData
       }                                            from '@mubble/core'
import * as NATIVE                                  from './native-constants'
import { RunContextBrowser }                        from '../../rc-browser'
import { MuWebBridge }                              from './web-bridge'
import { NgZone }                                   from '@angular/core'
import { EventSystem }                              from '../../util'
import { APP_UI_EVENT }                             from '../app-ui-event'

export const ANDROID = 'Android'
export const IPAD    = 'iPad'

export interface ReferrerParams {
  utm_source    : string
  utm_medium    : string
  utm_campaign  : string
  utm_term      : string
  utm_content   : string
  gclid         : string
  mode          : string
}


export enum State {
  LOADING,      // The js files are getting parsed and loaded in memory
  INITIALIZED,  // Code initialized and the bridge is up
  SHOWN         // UI being displayed, albeit busy in server requests
}

export enum SDK_TYPE {
  MOBILE  = 'MOBILE',    // mobile SDK with Obopay app installed
  WEB     = 'WEB',       // web SDK
  CORDOVA = 'CORDOVA'    // mobile SDK with Obopay app not installed; web invocation
}

export enum UserAgent {
  BROWSER = 'BROWSER',
  ANDROID = 'ANDROID',
  IOS     = 'IOS'
}

export interface Location {
  lat : number
  lng : number
}

export interface MobileSdkParams {
  source    : string
  requestId : number
}

class InitConfig {

  remoteUrl        : string
  appVersion       : string                 = ''
  localStoragePath : string                 = ''
  appChannel       : string                 = 'WEB'

  pseudoId         : string                 = ''
  fcmId            : string                 = ''
  adId             : string                 = ''
  deviceId         : string                 = ''

  appInstallTs     : number                 = Date.now()
  migrationInfo    : Mubble.uObject<string>

  constructor(remoteUrl : string) {
    this.remoteUrl  = remoteUrl
  }
}

class LaunchContext {

  directLink        : string
  source            : string // mobile SDK package name 
  referrerParams    : ReferrerParams = {} as ReferrerParams
  isUpgrade         : boolean = false
}

export class MuBridge {

  public  currKeyboardHt        : number
  protected runningInBrowser    : boolean = false

  private nextRequestId         : number = 1
  private requestMap            : Mubble.uObject<NativeAsyncRequest> = {}

  private location              : object
  private netType               : string
  private _state                : State
  protected userAgent           : UserAgent
  protected permObj             : object

  private initConfig            : InitConfig 
  protected launchContext       : LaunchContext = new LaunchContext()

  protected webBridge           : MuWebBridge
  protected sdkType             : SDK_TYPE
  protected mobileSdkParams     : MobileSdkParams = {} as MobileSdkParams



  constructor(protected rc      : RunContextBrowser,
              protected ngZone  : NgZone) {
  }

  // WARNING: rc is not initied at this stage. Do not use
  preInit(remoteUrl : string) {

    this.initConfig = new InitConfig(remoteUrl)

    if (window['webkit'] && window['webkit'].messageHandlers.cordova) {

      this.userAgent  = UserAgent.IOS
      this.permObj    = NATIVE.IOS_PERM
      
    } else if (window['cordova']) {

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

    if (this.userAgent === UserAgent.BROWSER) {
      this.onConnectionAttr(navigator.onLine ? NetworkType.wifi : null, null)

    } else {
      const data          = await this.getInitData()
      this.initConfig     = data['initConfig']
      this.launchContext  = data['launchContext']
      
      const connAttr      = data['connAttr']
      this.onConnectionAttr(connAttr['netType'], connAttr['location'])
    }

    if (this.launchContext.referrerParams && 
        this.launchContext.referrerParams.mode === NATIVE.LaunchContextMode.BUSINESS) {
      this.sdkType = SDK_TYPE.MOBILE
    }
  }

  isRunningInDev() {
    return this.initConfig.remoteUrl == 'http://localhost'
  }

  isRunningInBrowser() {
    return this.runningInBrowser
  }

  isRunningInMWeb() {
    return window.navigator.userAgent.includes(ANDROID) && this.isRunningInBrowser()
  }

  isRunningInIPad() {
    return window.navigator.userAgent.includes(IPAD)
  }

  isRunningInMobile() {
    return this.isAndroid() || this.isIos() || this.isRunningInMWeb()
  }

/*==============================================================================
                                    STATE  
==============================================================================*/

  get state() {
    return this._state
  }

  set state(newState: State) {
    this._state = newState
    if (this.userAgent !== UserAgent.BROWSER) {
      this.sendAsyncRequest('setStateFromJs', State[this._state])
    }
  }

  setStateShown() {
    this.state = State.SHOWN
  }

/*==============================================================================
                              LAUNCH CONTEXT 
==============================================================================*/

  getDirectLink() {
    return this.launchContext.directLink
  }

  setWebDirectLink(directLink: string) {
    this.launchContext.directLink = directLink
  }

  resetDirectLink() {
    this.launchContext.directLink = null
  }

  getReferrerParams(): ReferrerParams {
    return this.launchContext.referrerParams
  }

  isUpgrade() {
    return this.launchContext.isUpgrade
  }

/*==============================================================================
                               INIT CONFIG 
==============================================================================*/

  getUserAgent() {
    return this.userAgent
  }

  getRemoteUrl() {
    return this.initConfig.remoteUrl
  }

  getAppVersion() {
    return this.initConfig.appVersion
  }

  getAppChannel() {
    return this.initConfig.appChannel
  }

  getPseudoId() {
    return this.initConfig.pseudoId
  }

  getFcmId() {
    return this.initConfig.fcmId
  }

  getAdId() {
    return this.initConfig.adId
  }

  getAppInstallTime(): number {
    return this.initConfig.appInstallTs
  }

  getDeviceId() {
    return ''
  }

  getLocation(): string {
    return JSON.stringify(this.location)
  }

  getCordovaNetworkType() {
    return this.netType
  }

  getLocalStoragePath() {
    return this.initConfig.localStoragePath
  }
 
/*==============================================================================
                              Bridge Utils
==============================================================================*/

  isAndroid() {
    return (this.userAgent === UserAgent.ANDROID)
  }

  isIos() {
    return (this.userAgent === UserAgent.IOS)
  }

  async writeExternalStyles(base64Data: string) {

    const path = this.getLocalStoragePath() + "/styles/",
          name = "external.css"

    const json = await this.sendAsyncRequest('saveBinaryFile', path, name, base64Data) 
    return json['success']
  }

  async enableDebug() {

    this.rc.setGlobalLogLevel(LOG_LEVEL.DEBUG)
    this.rc.globalKeyVal.logLevel = LOG_LEVEL.DEBUG
    await this.setDebuggable()
    this.rc.uiRouter.showToast('Log level changed to debug')
  }

  getUserProfilePicUrl(clientId: number, profilePicFileName?: string): string {
    return ''
  }

/*==============================================================================
                          Init Data 
==============================================================================*/

  async getInitData(): Promise<Object> {

    const obj = await this.sendAsyncRequest('getInitData')
    return obj
  }

  async getDeviceInfo(): Promise<Object> {

    const obj = await this.sendAsyncRequest('getDeviceInfo')
    return obj
  }

/*==============================================================================
                          Session APIs 
==============================================================================*/

  async getSessionInfo(): Promise<NATIVE.NativeRouterResponse> {

    const obj = await this.sendAsyncRequest('getSessionInfo')
    return obj as NATIVE.NativeRouterResponse
  }

  async recreateSession(): Promise<NATIVE.NativeRouterResponse> {

    const obj = await this.sendAsyncRequest('recreateSession')
    return obj as NATIVE.NativeRouterResponse
  }

/*==============================================================================
                          Analytics 
==============================================================================*/

  async setUserId(userId: number) {
    await this.sendAsyncRequest('setUserId', String(userId))
  }

  async logEvent(eventName: string, eventDataStr: string) {
    await this.sendAsyncRequest('logEvent', eventName, eventDataStr)
  }

  async setUserProperty(propName: string, value: string) {
    await this.sendAsyncRequest('setUserProperty', propName, value)
  }

/*==============================================================================
                            Storage
==============================================================================*/

  async setGlobalKeyValue(key: string, value: string) {
    await this.sendAsyncRequest('setGlobalKeyValue', key, value)
  }

  async getGlobalKeyValue(key: string): Promise<string> {
    const object = await this.sendAsyncRequest('getGlobalKeyValue', key)
    return object['value']
  }

  async setUserKeyValue(key: string, value: string) {
    await this.sendAsyncRequest('setUserKeyValue' ,key, value)
  }

  async getUserKeyValue(key: string): Promise<string> {
    const object = await this.sendAsyncRequest('getUserKeyValue', key)
    return object['value']
  }

  async setGcConfig(config: string) {
    await this.sendAsyncRequest('setGcConfig', config)
  }

  async getGcConfig(category: string, key: string): Promise<string> {
    const object = await this.sendAsyncRequest('getGcConfig', category, key)
    return object['value']
  }

/*==============================================================================
                            Xmn Requests
==============================================================================*/

  async prepareConnection() {
    await this.sendAsyncRequest('prepareConnection')
  }

  async sendRouterRequest(api: string, params: object): Promise<NATIVE.NativeRouterResponse> {

    const obj = await this.sendAsyncRequest('sendRequest', api, JSON.stringify(params))
    return obj as NATIVE.NativeRouterResponse
  }

  async sendRouterEvent(name: string, params: object, ephemeral: boolean) {
    await this.sendAsyncRequest('sendEvent', name, JSON.stringify(params), ephemeral)
  }

/*==============================================================================
                             Fingerprint
==============================================================================*/

  async fingerprintScan(data: string): Promise<Object> {
    const obj = await this.sendAsyncRequest('fingerprintScan', data)
    return obj
  }

  async canAuthWithFingerprint(): Promise<boolean> {
    const obj = await this.sendAsyncRequest('canAuthWithFingerprint')
    return obj['canAuth']
  }

  async generateFpKeyPair() {
    const obj = await this.sendAsyncRequest('generateFpKeyPair')
    return obj['pubKey']
  }

/*==============================================================================
                             Camera
==============================================================================*/

  //  /**
  //   * @param aspectRatio : '16/9', '4/3'
  //   * @returns { success: boolean, base64: string, mimeType: string, cropped: boolean, failureCode: string }
  //   */
  async takePictureFromCamera(aspectRatio = '1') {
    const obj = await this.sendAsyncRequest('takePictureFromCamera', aspectRatio) 
    return obj
  }

  // /**
  //   * @returns { success: boolean, base64: string, mimeType: string, cropped: boolean, failureCode: string }
  //   */
  async selectPictureFromGallery() {
    const obj = await this.sendAsyncRequest('selectPictureFromGallery') 
    return obj
  }

/*==============================================================================
                             Permission
==============================================================================*/

  async getPermission(permission: NATIVE.Permission, showRationale: boolean = true): 
    Promise<{permGiven : boolean, dialogShown: boolean, webStream? : MediaStream}> {

    const json = await this.sendAsyncRequest('getPermission', this.permObj[permission], showRationale)
    return { permGiven: json['permissionGiven'], dialogShown: json['dialogShown']}
  }

  async hasPermission(permission: NATIVE.Permission): Promise<boolean> {

    const obj = await this.sendAsyncRequest('hasPermission', this.permObj[permission])
    return obj['hasPerm']
  }

/*==============================================================================
                             File I/O
==============================================================================*/

  async saveBinaryFile(filePath: string /* embeds ncInstanceId */, fileName: string, 
    base64Data: string) {
    const json = await this.sendAsyncRequest('saveBinaryFile', filePath, fileName, base64Data)
    return json['success']
  }
  
  //  /**
  //   * @returns { base64: string, checkSum: string, mimeType: string }
  //   */
  async selectDocumentFile(): Promise<object> {
    const obj = await this.sendAsyncRequest('selectDocumentFile')
    return obj
  }

  async openPdfViewer(base64 : string) {
    await this.sendAsyncRequest('openPdfViewer', base64)
  }

  async openShareIntent(base64 : string) {
    await this.sendAsyncRequest('openShareIntent', base64)
  }

  async saveImageToGallery(base64 : string) {
    await this.sendAsyncRequest('saveImageToGallery', base64)
  }

/*==============================================================================
                             Phone / SMS
==============================================================================*/

  async placeCall(mobileNumber: string) {
    mobileNumber  = this.rc.utils.sanitizeNumber(mobileNumber)
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `Placing call with number ${mobileNumber}`)
    await this.sendAsyncRequest('placeCall', mobileNumber)
  }

  async listenForSmsCode() {
    await this.sendAsyncRequest('listenForSmsCode')
  }

  async requestMobNumHint() {

    if (this.userAgent !== UserAgent.ANDROID) return null
    const resp = await this.sendAsyncRequest('requestMobNumHint')
    return resp ? resp['selectedId'] : null
  }

  async getPhoneContacts() {
    const obj = await this.sendAsyncRequest('getPhoneContacts')
    return obj['contacts']
  }

/*==============================================================================
                             Scan
==============================================================================*/

  async takeSignature(invSource: string) : Promise<Object> {
    const resp = await this.sendAsyncRequest('takeSignature', invSource)
    return resp
  }

  async scanQrCode(invSource: string, title : String) : Promise<object> {

    const object = await this.sendAsyncRequest('scanQrCode', invSource, title)
    const scanResult  = {
      result  : object['result'],
      action  : object['action']
    }
    return scanResult
  }

  async scanBarcode(invSource: string): Promise<Object> {

    if (!await this.hasPermission(NATIVE.Permission.CAMERA)) {
      const resp = await this.getPermission(NATIVE.Permission.CAMERA)
      if (!resp.permGiven) {
        this.rc.uiRouter.showToast('Can\'t scan Barcode without Camera permission')
        return null
      }
    }

    const obj = await this.sendAsyncRequest('scanBarcode', invSource)
    return obj
  }

  ///**
  // * @returns { action: string, result: string }
  // *
  // * Eg. action : SAVED_PAYEES, DISMISS, SCAN
  // * result : Scanned result if action is SCAN
  // */
  async payViaQr(invSource: string): Promise<object> {

    const object = await this.sendAsyncRequest('payViaQr', invSource)
    return object
  }

/*==============================================================================
                        Common Cordova Utilities
==============================================================================*/

  async setDebuggable() {
    await this.sendAsyncRequest('setDebuggable')
  }

  async showNativeToast(msg: String) {
    await this.sendAsyncRequest('showToast', msg)
  }

  async closeApp() {
    await this.sendAsyncRequest('closeApp')
  }

  async openInMobileBrowser(url: string) {
    await this.sendAsyncRequest('openInMobileBrowser', url)
  }

  async closeMobileBrowser() {
    await this.sendAsyncRequest('closeMobileBrowser')
  }

  async launchAppMarket(packageName : string = '') {
    await this.sendAsyncRequest('launchAppMarket', packageName)
  }

  async reinstallFromAppMarket() {
    await this.sendAsyncRequest('reinstallFromAppMarket')
  }

  async sendMail(email ?: string, subject ?: string, body ?: string) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), {email, subject})
    return await this.sendAsyncRequest('sendMail', email || '', subject || '', body || '')
  }

  async checkIfPkgInstalled(pkgName: string): Promise<boolean> {
    const obj = await this.sendAsyncRequest('checkIfPkgInstalled', pkgName)
    return obj['installed']
  }

  async launchNavigationOnMap(lat:string,lng:string) {
    await this.sendAsyncRequest('launchNavigationOnMap', lat,lng)
  }

  async copyToClipBoard(text: string) {
    return await this.sendAsyncRequest('copyToClipBoard', text)
  }

  async openSoftInputKeyboard() {
    if (this.userAgent === UserAgent.ANDROID) await this.sendAsyncRequest('openSoftInputKeyboard')
  }

  async hideSoftInputKeyboard() {
    if (this.userAgent === UserAgent.ANDROID) await this.sendAsyncRequest('hideSoftInputKeyboard')
  }

  async resetApp() {
    await this.sendAsyncRequest('resetApp')
  }

  async getCurrentLocation(): Promise<Location> {

    const json = await this.sendAsyncRequest('getCurrentLocation')
    return {
      lat : json['lat'],
      lng : json['lng']
    }
  }

  async setVerStringToken(clientTransactionId: string) {
    await this.sendAsyncRequest('setVerStringToken', clientTransactionId)
  }

/*------------------------------------------------------------------------------
  F R O M    N A T I V E
------------------------------------------------------------------------------*/

  async asyncRequestFromNative(fnName: string, requestTag: string, ...params: any[]) {

    this.ngZone.run(() => {
      this.asyncRequestFromNativeInternal(fnName, requestTag, params)
    })
  }

  private async asyncRequestFromNativeInternal(fnName: string, requestTag: string, ...params: any[]) {

    const fn = this[fnName]
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      typeof fn === 'function', fnName)

    const resp = await fn.apply(this, params)

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      resp && (typeof resp === 'object'), resp)

    if (this.userAgent !== UserAgent.BROWSER) {
      this.sendAsyncRequest('asyncRequestResponseFromJs', requestTag, JSON.stringify(resp))
    }
  }

  eventFromNative(eventName: string, ...params: any[]) {

    this.ngZone.run(() => {

      const fnName  = `on${eventName}`,
            fn      = this[fnName]

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
        typeof fn === 'function', fnName)

      fn.apply(this, params)

    })
  }

/*------------------------------------------------------------------------------
  E V E N T S   F R O M   N A T I V E
------------------------------------------------------------------------------*/

  private onUpdateCustomData(json: object) {
    this.rc.router.updateCustomData(this.rc, json as CustomData)
  }

  private onEphEvent(wo: object) {
    this.rc.router.providerMessage(this.rc, [wo as WireObject])
  }

  protected onVerSmsCode(smsBody: string) {
    // this.rc.uiRouter.getRoot().onVerificationSmsCode(smsBody)
  }

  private onVerSmsTimeout() {

  }

  private onMobileBrowserClosed() {
    EventSystem.broadcast(this.rc, APP_UI_EVENT.MOBILE_BROWSER_CLOSED)
  }

  private onAdjustPan(factorHeight: number) {
    this.currKeyboardHt = factorHeight
    EventSystem.broadcast(this.rc, APP_UI_EVENT.ADJUST_PAN_FOR_SCREEN)
  }

  private onFingerprintScanResult(result: string) {
    EventSystem.broadcast(this.rc, APP_UI_EVENT.FINGERPRINT_SCAN_RESULT, JSON.parse(result))
  }

  protected onConnectionAttr(netType: string, location: object) {

    if (netType) this.netType = netType

    if (!location) return

    const lat: number = location['lat']
    const lng: number = location['lng']

    if (lat && lng) {
      this.location = location
    }
  }

  private onScreenPause() {
    EventSystem.broadcast(this.rc, APP_UI_EVENT.CORDOVA_SCREEN_PAUSE)
  }

  private onScreenResume() {
    EventSystem.broadcast(this.rc, APP_UI_EVENT.CORDOVA_SCREEN_RESUME)
  }

  onLaunch(directLink: string) {

    if (!directLink) return
    this.launchContext.directLink = directLink
    //this.rc.uiRouter.getRoot().showLanding(false, false)
  }

  setDirectLink(directLink: string) {

    if (!directLink) return
    this.launchContext.directLink = directLink
  }

/*------------------------------------------------------------------------------
  A P P  R E Q U E S T 
------------------------------------------------------------------------------*/

  /**
   * Request has a response to be given back to JS mapped with requestId
   * @param messageId API to be called
   * @param params arguments for the API
   */
  protected async sendAsyncRequest(apiName: string, ...params: any[]) {

    const nar = new NativeAsyncRequest(this.nextRequestId++, apiName)
    this.requestMap[nar.requestId] = nar

    switch(this.userAgent) {

      case UserAgent.ANDROID:
        window['cordova'][apiName](nar.requestId, ...params)
        break

      case UserAgent.IOS:
        window['webkit'].messageHandlers.cordova.postMessage({ requestId: nar.requestId, 
          method: apiName, args: params })
        break

      case UserAgent.BROWSER:
        this.webBridge.handleRequest(nar.requestId,apiName, params)
        break
    }
    
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `Response received for sendAsyncRequest: requestid: ${nar.requestId}, 
      apiName: ${apiName}`)
    return await nar.promise
  }

  // TODO: make private, web-bridge dependency
  asyncResponseFromNative(requestId: number, json: object) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `asyncResponseFromNative requestId:${requestId} Response:${JSON.stringify(json)}`)
    const nar: NativeAsyncRequest = this.requestMap[requestId]
    if (!nar) {
      this.rc.isError() && this.rc.error(this.rc.getName(this), 'Request id', 
          requestId, 'is missing in request map')
      return
    }
    delete this.requestMap[requestId]
    nar.resolve(json)
  }

/*==============================================================================
                                 SDK 
==============================================================================*/

  isWebSdkInvocation(): boolean {
    return this.sdkType === SDK_TYPE.WEB || this.sdkType === SDK_TYPE.CORDOVA
  }

  isMobileSdkInvocation(): boolean {
    return this.sdkType === SDK_TYPE.MOBILE
  }

  isSdkInvocation(): boolean {
    return !!this.sdkType
  }

  getSdkType(): SDK_TYPE {
    return this.sdkType
  }

  setMobileSdkParams(source: string, requestId: string) {
    this.mobileSdkParams.source     = source
    this.mobileSdkParams.requestId  = Number(requestId)
  }

  getMobileSdkSource() {
    return this.mobileSdkParams.source
  }

  getMobileSdkRequestId() {
    return this.mobileSdkParams.requestId
  }

  /**
   * This will only get invoked for Sdk type Mobile since this is the main app and 
   * any SDK invocation would happen wrt a direct link and response via Intent broadcast
   * in Android 
   */
  async onSdkSuccessResponse(requestId: number, data: object = null, closeApp: boolean = true) {
    
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), requestId, 
      `RequestId is not defined`)

    if (this.sdkType !== SDK_TYPE.MOBILE) {
      this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 
        `Came to Bridge SDK response for inv other than SDK Type Mobile, returning...`)
      return
    }

    const resp = Object.assign({ code : 'SUCCESS' }, data) 
    await this.onMobileSdkResponse(requestId, resp, closeApp)
  }

  async onSdkFailureResponse(requestId: number, data: object, uiError: Object, closeApp: boolean = true) {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), requestId, 
      `RequestId is not defined`)

    if (this.sdkType !== SDK_TYPE.MOBILE) {
      this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 
        `Came to Bridge SDK response for inv other than SDK Type Mobile, returning...`)
      return
    }

    let resp = Object.assign({ code : 'FAILURE' }, data)
        resp = Object.assign(uiError, resp)
    await this.onMobileSdkResponse(requestId, resp, closeApp)
  }

  protected async onMobileSdkResponse(requestId: number, data: object, closeApp: boolean = true) {
    
    const obj = Object.assign({ requestId, source : this.getMobileSdkSource()}, data)
    await this.sendAsyncRequest('onMobileSdkResponse', JSON.stringify(obj), closeApp)
  }

}

export class NativeAsyncRequest {
      
  promise         : Promise<object>
  resolve         : (object) => void
  reject          : () => void

  constructor(public requestId : number, 
              public apiName: string) {

    this.promise    = new Promise((resolve, reject) => {
      this.resolve  = resolve
      this.reject   = reject
    })
  }
}
