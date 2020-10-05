/*------------------------------------------------------------------------------
   About      : UI router BaseApp app specific implementation 
   
   Created on : Sat Nov 03 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Injectable, Inject }       from '@angular/core'
import { Router }                   from '@angular/router'
import { UiRouter, 
         TranslateService,
         TOAST_POSITION, 
         DIRECTION,
         TrackableScreen,
         NcNavigationExtras
       }                            from '../../ui'
import { Mubble, 
         LOG_LEVEL 
       }                            from '@mubble/core'
import { RunContextBrowser }        from '../../rc-browser'
import { AnalyticsScreenManager }   from '../analytics'
import { HashidParams }             from '../constants'

export interface RoutingInfo {
  routeTo     : string
  queryParams : Mubble.uObject<any>
  hostName    : string
}

@Injectable()
export class MuUiRouter extends UiRouter {

  // helper for ui framework
  analyticsScreenMgr    : AnalyticsScreenManager
  protected appProtocol : string
  protected appHost     : string


  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              router                              : Router,
              protected translate                 : TranslateService) {

    super(rc, router)

    rc.setupLogger(this, 'AppUiRouter', LOG_LEVEL.DEBUG)
    
    if (rc.getGlobalLogLevel() === LOG_LEVEL.DEBUG) {
      window['uiRouter']  = this
    }

    rc.uiRouter             = this
    this.analyticsScreenMgr = new AnalyticsScreenManager(rc)
  }

  setAppProtoAndHost(appProtocol : string, appHost  : string) {

    this.appHost      = appHost
    this.appProtocol  = appProtocol
  }

  public showToast(toastMessage: string, stay ?: boolean, position ?: TOAST_POSITION) {
    
  }

  public showOverlay(overlayText: string = this.translate.instant('cmn_loading')) {
  //   this.rootComp.showOverlay(overlayText)
  }

  public removeOverlay() {
    // this.rootComp.removeOverlay()
  }

  /**
   * Parse URL of the form route?params
   */
  getRoutingInfoForNavUrl(navUrl : string) {

    navUrl = `${this.appProtocol}://${this.appHost}/` + navUrl
    return this.getRoutingInfo(navUrl)
  }

  /**
   * Parse URL of the form protocol://host/route?params
   */
  getRoutingInfo(directLink : string) {

    const dlObj = this.rc.utils.parseURLForRouter(directLink)

    const routingInfo : RoutingInfo = {
      routeTo     : dlObj.pathname,
      queryParams : dlObj.searchObject || {},
      hostName    : dlObj.hostname
    }

    if (routingInfo.queryParams[HashidParams.LogLevel]) {
      const logLevel = Number(routingInfo.queryParams[HashidParams.LogLevel])
      if (this.rc.globalKeyVal.logLevel !== logLevel && logLevel === LOG_LEVEL.DEBUG) {
        this.rc.bridge.enableDebug()
      }
    }

    return routingInfo
  }

  navigateByDirectLink(directLink : string, ncExtracs ?: NcNavigationExtras) {

    const routingInfo = this.getRoutingInfoForNavUrl(directLink)
    
    ncExtracs = ncExtracs || {}
    
    const params : NcNavigationExtras  = {
      queryParams : routingInfo.queryParams
    }

    for (const key in ncExtracs)  {
      if (!params[key]) {
        params[key] = ncExtracs[key]
      }
    }
    

    this.navigate(routingInfo.routeTo, params)
  }

  // navigateForInfo(screen: TrackableScreen, navInfo: NavInfo, ncExtras ?: NcNavigationExtras) {

  //   if (!navInfo) return

  //   this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
  //     navInfo.navUrl && navInfo.logName, `missing navUrl or logName 
  //     ${navInfo.logName}, ${navInfo.navUrl}`)

  //   this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
  //     `Came to navigate: LogName-${navInfo.logName}, Url-${navInfo.navUrl}`)

  //   this.logScreenAction(screen, navInfo.logName)
  //   this.navigateByDirectLink(navInfo.navUrl, ncExtras)
  // }
  /*--------------------------------------------------------------------------------------------------------------
    History Stack management
  --------------------------------------------------------------------------------------------------------------*/
  onDeviceBack() {

    this.rc.isStatus() && this.rc.status(this.rc.getName(this),'Device back')

    window.setTimeout(() => {
      if (this.urlStack.length === 1) {
        if (this.warnedUser) {
          this.analyticsScreenMgr.logScreenAction(this.analyticsScreenMgr.getCurrentScreenName(), 'close_app')
          this.notifyAppClose()
        } else {
          this.showToast(this.translate.instant('cmn_press_back'))
          this.warnedUser = true
        }
      } else {
        this.analyticsScreenMgr.logScreenAction(this.analyticsScreenMgr.getCurrentScreenName(), 'sys_back')
        this.goBack()
      }
    }, 0)
  }



  setCurrentTabRoutes(tabRoutes: string[]) {
    this.analyticsScreenMgr.setCurrentTabRoutes(tabRoutes)
  }

  onTabNavEnd(currScreenName : string, currentIndex : number) {
    this.analyticsScreenMgr.onTabNavEnd(currScreenName, currentIndex)
  }

  onTabDestroy() {
    this.analyticsScreenMgr.onTabDestroy()
  }

  logScreenActionScroll(screen: TrackableScreen, direction: DIRECTION) {
    this.analyticsScreenMgr.logScreenActionScroll(screen.getRouteName(), direction)
  }

  logScreenAction(screen: TrackableScreen, actionName: string) {
    this.analyticsScreenMgr.logScreenAction(screen.getRouteName(), actionName)
  }

  logScreenState(screen: TrackableScreen, stateName: string, stateValue: number | string) {
    this.analyticsScreenMgr.logScreenState(screen.getRouteName(), stateName, stateValue)
  }


  
  getRoot() {
    return {

      getBusinessId() {
        return ''
      },

      onPayUResponse(data : object) {

      },

      handleError(e: Error) {
        // YTODO - should implement handle error
        this.rc.isStatus() && this.rc.status(this.rc.getName(this), `Came to handleError inside library: ${e}`)
        // this.showError(e.message)
        // this.showJS()
      }
      
      
    }
  }

}