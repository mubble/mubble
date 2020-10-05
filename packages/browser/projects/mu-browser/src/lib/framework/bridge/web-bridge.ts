import { RunContextBrowser }    from '../../rc-browser'
import { MuWebApi }             from './web-api'
import { Permission }           from './native-constants'

export class MuWebBridge {

  webApi : MuWebApi

  constructor(protected rc : RunContextBrowser) {
    this.webApi = new MuWebApi(rc)
  }

  async handleRequest(requestId: number, apiName: string, ...params: any[]) {
    if (!this[apiName]) {
      throw new Error(`Missing API ${apiName} implementation in Web bridge.`)
    }
    const obj = await this[apiName](params[0])
    this.rc.bridge.asyncResponseFromNative(requestId, obj)
  }

/*==============================================================================
                          FIREBASE 
==============================================================================*/

  setUserId(userId: number) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `Setting userId ${userId}`)
  }

  logEvent(eventName: string, eventDataStr: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `Logging event: ${eventName} Data: ${eventDataStr}`)
  }

  setUserProperty(propName: string, value: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `Setting userProperty: ${propName} Value: ${value}`)  
  }

  protected fingerprintScan() {
    // this.rc.uiRouter.showToast('fingerprintScan Feature not supported for Browser')
    return
  }

  protected scanBarcode() {
    // this.rc.uiRouter.showToast('scanBarcode Feature not supported for Browser')
    return null
  }

  protected payViaQr() {
    this.rc.uiRouter.showToast('payViaQr Feature not supported for Browser')
    return null
  }

  protected openInMobileBrowser(url : string) {
    window.open(url)
  }

  protected getNativeMigrationInfo() {
    // this.rc.uiRouter.showToast('get native migration info not supported for Browser')
    return null
  }

  protected getCurrentLocation() {

    if (navigator.geolocation) {
      // check if geolocation is supported/enabled on current browser
      navigator.geolocation.getCurrentPosition(

        function success(position) {
          // for when getting location is a success
          return {
            lat : position.coords.latitude,
            lng : position.coords.longitude
          }
        },

        function error(error_message) {}
      );
    }

    return null
  }

  protected closeMobileBrowser() {
    
  }

  protected getPhoneContacts() {
    return {contacts : []}
  }

  protected async hasPermission(params : any[]) {
    // this.rc.uiRouter.showToast(`${permission} feature not supported for browser`)
    const permission    : Permission  = params[0] 
    return { 'hasPerm' : await this.webApi.hasPermission(permission) }
  }

  protected requestMobNumHint() {
    this.rc.uiRouter.showToast('requestMobNumHint Feature not supported for Browser')
    return null
  }

  protected async takePictureFromCamera() {
    this.rc.uiRouter.showToast('takePictureFromCamera Feature not supported for Browser')
    const resp = await this.webApi.getPictureFromCamera()
    return resp
  }

  protected selectDocumentFile() {
    this.rc.uiRouter.showToast('selectDocumentFile Feature not supported for Browser')
    return {'success': false} 
  }

  protected selectPictureFromGallery() {
    this.rc.uiRouter.showToast('selectPictureFromGallery Feature not supported for Browser')
    return {'success': false}
  }

  protected async getPermission(params : any[]) {
    const permission    : Permission  = params[0] 
    const showRationale : boolean     = params[1] || true
    return { permissionGiven: await this.webApi.getPermission(permission), dialogShown: true}
  }

  protected writeExternalStyles(base64Data: string) {
    this.rc.uiRouter.showToast('writeExternalStyles Feature not supported for Browser')
    return true
  }

  protected saveBinaryFile(filePath: string /* embeds ncInstanceId */, fileName: string, 
                         base64Data: string) {
    this.rc.uiRouter.showToast('saveBinaryFile Feature not supported for Browser')
    return true
  }

  protected setNotificationConfig(config: string) {
  }

  protected closeApp() {
    window.location.reload()
  }

  protected launchAppMarket(packageName ?: string) {
    window.open(`https://play.google.com/store/apps/details?id=${packageName}`)
  }

  protected sendMail(email ?: string, subject ?: string, body ?: string) {
    this.rc.uiRouter.showToast(`SendMail Feature not supported for Browser`)
  }

  protected placeCall(mobileNumber: string) {
    this.rc.uiRouter.showToast(`PlaceCall Feature not supported for Browser`)
  }

  protected checkIfPkgInstalled(pkgName: string) {
    this.rc.uiRouter.showToast(`checkIfPkgInstalled Feature not supported for Browser`)
    return false
  }

  protected listenForSmsCode() {

  }

  protected setVerStringToken(clientTransactionId: string) {

  }

  protected copyToClipBoard(text: string) {
    this.rc.uiRouter.showToast(`copyToClipBoard Feature not supported for Browser`)
    return false
  }

  protected openSoftInputKeyboard() {

  }

  protected hideSoftInputKeyboard() {

  }

  protected canAuthWithFingerprint() {
    return { canAuth : false }
  }

  protected logOutCurrentUser() {
    window.location.reload()
  }

  protected resetApp() {

    localStorage.clear()
    window.location.reload()
  }

  protected getDeviceInfo() {
    return '{}'
  }

  protected setDebuggable() {
    
  }

}