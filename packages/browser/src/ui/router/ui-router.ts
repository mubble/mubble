/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Jun 16 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import { Injectable, Inject }   from '@angular/core'

import {
  CanActivate, Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  CanActivateChild,
  NavigationExtras,
  CanLoad, Route,
  NavigationStart,
  NavigationEnd,
  UrlSegment,
  UrlTree, 
}                               from '@angular/router'

import { Mubble }               from '@mubble/core'

import { INJECTION_PARAM, 
         InjectionCaller }      from '../mu-components/injection-interface'

import * as lo                  from 'lodash'

import { DIRECTION }            from '../nail'
import { RunContextBrowser }    from '../../rc-browser'
import { ComponentRoutes }      from './shared-router-constants'
import { AlertDialogParams,
         AlertDialogComponent } from '../mu-components/alert-dialog/alert-dialog.component'

const ROOT_URL     = '#/?launched=true'

const hashIndex = location.href.indexOf('#'),
      baseHref  = hashIndex !== -1 ? location.href.substr(0, hashIndex) : location.href

const BASE_HREF    = baseHref

export const PRIMARY_OUTLET = 'primary',
             MODAL_OUTLET   = 'modal'

export enum TOAST_POSITION { TOP = 1, MIDDLE, BOTTOM }

export enum NavMethod {NEXT = 1, CURRENT, POP}
      
export type OUTLET = 'primary' | 'modal'

export interface NcNavigationExtras extends NavigationExtras {
  replaceIndex  ?: number
  paramsId      ?: string
}

class StackItem {
  url         : string
  qpId        : string
  queryParam  : Mubble.uObject<any>
  outlet      : OUTLET
}

class OutletEntry {
  component   : any    = null
  invCount    : number = 0
  lastParams  : Mubble.uObject<any>

  constructor(component: any) { this.component = component }
}

export class UiRouter {

  // helper for ui framework
  private historyWrapper  : HistoryWrapper

  private componentRegistry = {}

  // variables for navigation
  protected urlStack    : StackItem[]  = []
  protected warnedUser  : boolean   = false

  private firstNavDone  : boolean   = false
  private browserStack  : string[]  = []
  private urlPrefix     : string
  
  private lastNavMethod : NavMethod = 0
  private lastPopIndex  : number    = -1
  private lastNavUrl    : string    = ''
  private lastGoingBack : boolean   = false
  private curOutlet     : OUTLET
  private currentQpId   : string    = ''
  private curQueryParam : Mubble.uObject<any>
  private curCompMap    : Mubble.uObject<OutletEntry> = {}
  
  private codePop           : boolean = false
  private runningInBrowser  : boolean = false

  constructor(private rcBrowser         : RunContextBrowser,
              private router            : Router) {

    this.historyWrapper = new HistoryWrapper(rcBrowser)
  }

  public init(runningInBrowser: boolean) {

    this.runningInBrowser = runningInBrowser

    this.urlStack[0]      = new StackItem()
    this.urlStack[0].url  = (location.hash || '').substr(1)

    
    this.historyWrapper.replaceState({index: -1}, document.title, baseHref + ROOT_URL)
    this.historyWrapper.pushState({index: 0}, document.title, baseHref)

    window.addEventListener('popstate', this.onPopState.bind(this))
    this.browserStack[0]  = this.urlStack[0].url
    this.router.events.subscribe(this.onNavEnd.bind(this))

    this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'initialized with', {
      url           : this.urlStack[0].url
    })
  }

  public async navigate(routeTo: string, extras ?: NcNavigationExtras, replaceAllUrls : boolean = false) {

    if (replaceAllUrls) {
      if (!extras) {
        extras = {}
      }
      if (this.urlStack.length - 1 > 0) {
        extras.replaceIndex = 1
      }
    }

    return await this.navigateByUrl([routeTo], extras)
  }

  public async rootNavigate(routeTo: string, extras ?: NcNavigationExtras) {
    
    this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 
      'Inside RootNavigate', routeTo)
    if (!extras) extras = {}
    extras.replaceIndex = 0
    
    return await this.navigateByUrl([routeTo], extras, PRIMARY_OUTLET)
  }

  public areWeGoingBack() {
    return this.lastGoingBack
  }

  public isModalActive() {
    return Object.keys(this.curCompMap).length !== 1
  }

  public isShowingPopup() {
    return this.curOutlet !== PRIMARY_OUTLET
  }

  private async navigateByUrl(urlOrCommand: string | any[], extras ?: NcNavigationExtras, 
          outlet ?: OUTLET) {

    if (!extras) extras = {}
    if (!extras.queryParams) extras.queryParams = {}

    this.lastNavMethod && this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this), 
      'Navigating while last navigation not complete, possibly double nav...')

    if (extras.replaceIndex === undefined) {
      this.lastNavMethod  = extras.replaceUrl ? NavMethod.CURRENT : NavMethod.NEXT
      this.lastPopIndex   = -1
      this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 'Routing to', urlOrCommand, 'with', extras)
      this.lastGoingBack = false
    } else {
      this.lastGoingBack = true
      if (extras.replaceIndex >= this.urlStack.length) {
        this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this),
        'Ignoring navigation to replaceIndex that is more than number of items in stack', 
        {replaceIndex: extras.replaceIndex, urlStackLength: this.urlStack.length})
        extras.replaceIndex = this.urlStack.length - 1
      }

      this.lastNavMethod  = NavMethod.POP
      this.lastPopIndex   = extras.replaceIndex
      this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 'navigateByUrl: Route back by', 
        extras.replaceIndex - this.urlStack.length + 1, 'to url', urlOrCommand)
    }
    
    // prepare extras
    delete extras.replaceUrl
    extras.skipLocationChange = true

    const nc_paramsId = extras.paramsId || 'qp' + Date.now()

    let modalRoute: string 
    if (extras.queryParams) {
      modalRoute = extras.queryParams.modalRoute
    }
    
    this.currentQpId    = nc_paramsId
    this.curQueryParam  = extras.queryParams

    extras.queryParams  = modalRoute ? {nc_paramsId, modalRoute: modalRoute} : {nc_paramsId}
    
    this.curOutlet = outlet || PRIMARY_OUTLET

    const url = Array.isArray(urlOrCommand) ? this.router.createUrlTree(urlOrCommand, extras) : urlOrCommand
    this.lastNavUrl = typeof url === 'string' ? url : this.router.serializeUrl(url)

    if (await this.router.navigateByUrl(url, extras)) {
      return true
    }
  }

  public popupBottomIn(component: any, componentRoute: string, queryParams ?: any,
    replaceUrl?: boolean, caller ?: InjectionCaller) {
    if (!queryParams) queryParams = {}
    const repUrl: boolean = replaceUrl || false
    this.showInModal(component, componentRoute, queryParams, ComponentRoutes.BottomIn, caller, repUrl)
  }

  public popupModal(component: any, componentRoute: string, queryParams ?: any, 
    replaceUrl?: boolean, caller ?: InjectionCaller) {

    if (!queryParams) queryParams = {}
    const repUrl: boolean = replaceUrl || false
    this.showInModal(component, componentRoute, queryParams, ComponentRoutes.Modal, caller, repUrl)
  }

  public showAlertDialog(queryParams : AlertDialogParams, caller : InjectionCaller, replaceUrl ?: boolean) {
    this.popupModal(AlertDialogComponent, ComponentRoutes.Alert, queryParams, replaceUrl, caller)
  }

  public hasQueryParamsById(params): boolean {
    return !!params.nc_paramsId
  }

  public getCurrentComponent(outlet = PRIMARY_OUTLET): any {
    return this.curCompMap[outlet]
  }

  public getCurrentRouteName(): string {

    const topUrl: string = this.urlStack[this.urlStack.length-1].url
    return this.getRouteName(topUrl)
  }

  public getRouteName(url): string {

    const urlTree: UrlTree        = this.router.parseUrl(url)
    const segments: UrlSegment[]  = urlTree.root.children.primary.segments

    if (segments.length > 1) {
      let path = ''

      segments.forEach((segment, index) => {
        path += segment + (index < segments.length-1 ? '/' : '') 
      })
      return path
    }

    return segments[0].path
  }

  public getModuleName(url): string {

    const urlTree: UrlTree        = this.router.parseUrl(url)
    const segments: UrlSegment[]  = urlTree.root.children.primary.segments

    return segments[0].path
  }

  public getCurrentQueryParams(): any {
    return this.curQueryParam
  }

  public getQueryParams(params): any {

    const nc_paramsId = params.nc_paramsId
    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), nc_paramsId && nc_paramsId === this.currentQpId, 
      'Trying to retrieve non-existent params', params, this.currentQpId)

    return this.curQueryParam
  }

  public updateQueryParam(name: string, value: any) {

    const stackItem = this.urlStack[this.urlStack.length - 1],
          queryParam = stackItem.queryParam

    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), 
      queryParam, 'Your component does not get params by id')
    queryParam[name] = value
  }

  public setComponentForOutlet(component: any, outlet ?: OUTLET) {
    outlet = outlet || PRIMARY_OUTLET
    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), component)
    const oldEntry = this.curCompMap[outlet]

    if (oldEntry && oldEntry.component === component) return
    this.curCompMap[outlet] = new OutletEntry(component)
  }

  public removeComponentForOutlet(component: any, outlet ?: string) {
    outlet = outlet || PRIMARY_OUTLET
    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), this.curCompMap[outlet].component === component)
    delete this.curCompMap[outlet]
  }

  private showInModal(component: any, componentRoute: string, queryParams: any, 
    type: string, caller ?: InjectionCaller, replaceUrl?: boolean) {

    const compName = component.name
    this.registerComponent(compName, component)

    queryParams[INJECTION_PARAM.INJECT] = compName
    if (caller) queryParams[INJECTION_PARAM.CALLER] = caller
    
    queryParams.modalRoute = '(' + componentRoute + ')'
    const repUrl: boolean = replaceUrl || false
    
    this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), `Popping up ${type} for ${compName}`)
    this.navigateByUrl([{outlets: { modal: type}}], {replaceUrl: repUrl, 
      queryParams: queryParams}, MODAL_OUTLET)
  }

  public showModalPage(componentRoute: string, queryParams: any, replaceUrl?: boolean) {
    
    queryParams.modalRoute = '(' + componentRoute + ')'
    const repUrl: boolean = replaceUrl || false

    this.navigateByUrl([{outlets: { modal: componentRoute}}], 
      {replaceUrl: repUrl, queryParams: queryParams}, MODAL_OUTLET)
  }

  public goBack(whereOrByHowMuch ?: string | number) {
    if (!this.canGoBack()) return
    if (this.isModalActive()) {
      this.onPopUpClosed()
    }
    return this.goBackInternal(whereOrByHowMuch)
  }

  public goBackInternal(whereOrByHowMuch ?: string | number) {
    const stackLen = this.urlStack.length

    let index = typeof whereOrByHowMuch === 'number' ? stackLen + whereOrByHowMuch - 1 : stackLen - 2,
        where = typeof whereOrByHowMuch === 'string' ? whereOrByHowMuch : ''

    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), 
      index >= 0 && index < stackLen, {stackLen, whereOrByHowMuch, where, index})

    if (where) {
      if (!where.startsWith('/')) where = '/' + where
      for (; index >= 0; index--) {
        if (this.urlStack[index].url.startsWith(where)) break
      }
      if (index === - 1) {
        this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this), 
          'Could not find the desired url:', where, this.urlStack)
        throw(new Error('Could not find the desired url: ' + where))
      }
    }

    const urlStack = this.urlStack[index],
          ne: NcNavigationExtras  = {replaceUrl: true}

    if (urlStack.qpId) {
      ne.paramsId     = urlStack.qpId
      ne.queryParams  = urlStack.queryParam
    }

    ne.replaceIndex = index
    this.navigateByUrl(urlStack.url, ne, urlStack.outlet)
  }

  /*--------------------------------------------------------------------------------------------------------------
    History Stack management
  --------------------------------------------------------------------------------------------------------------*/
  
  private onPopState(e) {

    const index     = this.historyWrapper.getState().index,
          stackLen  = this.urlStack.length
    
    this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'onPopState', {stackLen, index})

    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), typeof index === 'number' && 
      index < (stackLen - 1), {stackLen, index})

    if (index === -1) {
      
      if (!this.codePop) {
        if (this.warnedUser || this.runningInBrowser) {
          this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this),
            'onPopState: Exiting the app', this.historyWrapper.getLength())
          this.notifyAppClose()
          
          if (!this.runningInBrowser) this.notifyAppClose() 
          else this.historyWrapper.go(-1)

          return
        } else {
          this.warnedUser = this.notifyUserBackPress()
        }
      } else {
        this.codePop = false
      }

      this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 
        'onPopState: Winding up stack on back to first item')

      for (let i = 0; i < stackLen; i++) {
        this.browserStack[i] = this.urlStack[i].url
        this.historyWrapper.pushState({index: i}, '', BASE_HREF + '#' + this.urlStack[i].url)
      }
      this.browserStack.length = stackLen

    } else {

      if (!this.canGoBack() || this.isToolTipShown()) {
        const lastIdx  = this.urlStack.length - 1,
        lastItem = this.urlStack[lastIdx]
        this.historyWrapper.pushState({index: lastIdx}, '', BASE_HREF + '#' + lastItem.url)
        this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'not going back')
        return
      }

      if (this.isModalActive()) {
        this.onPopUpClosed()
      }

      const goBackBy = index - stackLen + 1
      this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 
        'onPopState: Going back by', {index, goBackBy})

      this.goBackInternal(goBackBy)
    }
  }

  private onPopUpClosed() {
    const lastIdx  = this.urlStack.length - 1,
    lastItem = this.urlStack[lastIdx]

    if (!lastItem) return 
    const comp = this.curCompMap[lastItem.outlet]
    if (!comp || !comp.component.onBackPressed) return
    comp.component.onBackPressed()
  }

  private canGoBack() {
    const lastIdx  = this.urlStack.length - 1,
          lastItem = this.urlStack[lastIdx]
   
    if (!lastItem) return true
    const comp = this.curCompMap[lastItem.outlet]
    if (!comp || !comp.component.canGoBack) return true
    if (!comp.component.canGoBack()) {
      this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 
        'Skipping back as component dis-allowed back press')
      return false
    } else {
      this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 
        'Going back as component allowed back press')
      return true
    }
  }

  private onNavEnd(event ?: any) {

    if (!(event instanceof NavigationEnd)) {
      return
    }

    if (!this.firstNavDone) {
      
      this.firstNavDone   = true

      if (!this.lastNavMethod) {
        this.lastNavMethod  = NavMethod.CURRENT
        this.lastNavUrl     = event.url
        this.curOutlet      = PRIMARY_OUTLET
      }

      const url     = location.href,
            hashPtr = url.indexOf('#')

      this.urlPrefix   = hashPtr === -1 ? url : url.substr(0, hashPtr)
    }

    this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 'NavigationEnd', {
      url           : event.url, 
      lastNavMethod : NavMethod[this.lastNavMethod],
      lastPopIndex  : this.lastPopIndex,
      lastNavUrl    : this.lastNavUrl,
      stackLength   : this.urlStack.length
    })

    this.lastNavUrl !== event.url && this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this), 
      'onNavEnd without matching url desired:' + this.lastNavUrl + ' actual:' + event.url)

    let refIndex

    if (this.lastNavMethod === NavMethod.POP) {
      refIndex = this.lastPopIndex
    } else if (this.lastNavMethod === NavMethod.NEXT) {
      refIndex = this.urlStack.length
    } else if (this.lastNavMethod === NavMethod.CURRENT) {
      refIndex = this.urlStack.length - 1
    } else {
      this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this), 'Got a navigation without navMethod', 
        this.urlStack, location.href)
      throw('Got a navigation without navMethod')
    }

    const outletEntry = this.curCompMap[this.curOutlet]

    if (!outletEntry) {
      this.rcBrowser.isError() && this.rcBrowser.error(this.rcBrowser.getName(this), 'Current component is not known', {
        url           : event.url, 
        lastNavMethod : NavMethod[this.lastNavMethod],
        lastPopIndex  : this.lastPopIndex,
        stackLength   : this.urlStack.length
      })
    } 
    
    this.onMubbleScreenChange(event.url, this.curOutlet, this.lastNavMethod)
  
    if (this.urlStack.length === refIndex) this.urlStack[refIndex] = new StackItem()
    const urlStack = this.urlStack[refIndex]

    urlStack.url          = event.url
    urlStack.qpId         = this.currentQpId
    urlStack.queryParam   = this.curQueryParam
    urlStack.outlet       = this.curOutlet
    this.urlStack.length  = refIndex + 1

    this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 
    'Current Url stack', this.urlStack[refIndex].url)

    this.lastNavMethod  = 0
    this.lastPopIndex   = -1
    this.lastNavUrl     = ''
    this.curOutlet      = null

    this.setComponentParams(outletEntry)
  
    // When we remove the getParamsById function
    // this.currentQpId    = ''
    // this.curQueryParam  = null

    if (this.warnedUser) this.warnedUser = false
    this.syncBrowserHistory()

    this.onMubbleScreenNavEnd(event.url, this.lastNavMethod)
  }

  private setComponentParams(outletEntry: OutletEntry) {

    if (!outletEntry.component.onRouterInit) return

    const params = this.router.routerState.root.snapshot.queryParams,
          qp     = params.nc_paramsId ? this.curQueryParam : params

    if (lo.isEqual(qp, outletEntry.lastParams)) {
      this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'Skipping onRouterInit as parameters are same')
      return 
    }

    outletEntry.component.onRouterInit(qp, !outletEntry.invCount)
    outletEntry.invCount++
    outletEntry.lastParams = qp
  }

  private syncBrowserHistory() {

    const browserStack  = this.browserStack, 
          urlStack      = this.urlStack,
          stackLen      = urlStack.length

    let fromIndex = -1

    // sync browserStack
    for (let index = 0; index < stackLen; index++) {
      if (fromIndex === -1 &&
         (browserStack.length === index || browserStack[index] !== urlStack[index].url)) {
        fromIndex = index
        break
      }
    }

    // this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'syncBrowserHistory', 
    //   {fromIndex, stackLen, browserStackLen: browserStack.length})

    if (fromIndex === -1) {
      if (urlStack.length !== browserStack.length) this.browserGotoRoot()

    } else if (fromIndex === (stackLen - 1)) {

      if (browserStack.length === urlStack.length) {
        this.historyWrapper.replaceState({index: fromIndex}, '', BASE_HREF + '#' + urlStack[fromIndex])
        browserStack[fromIndex] = urlStack[fromIndex].url
      } else if (browserStack.length + 1 === urlStack.length) {
        this.historyWrapper.pushState({index: fromIndex}, '', BASE_HREF + '#' + urlStack[fromIndex])
        browserStack[fromIndex] = urlStack[fromIndex].url
      } else {
        this.browserGotoRoot()
      }
    } else {
      this.browserGotoRoot()
    }
  }

  private browserGotoRoot() {

    this.rcBrowser.isAssert() && this.rcBrowser.assert(this.rcBrowser.getName(this), this.historyWrapper.getState().index >= 0)

    const distanceFromRoot = -1 * this.historyWrapper.getState().index - 1
    this.rcBrowser.isDebug() && this.rcBrowser.debug(this.rcBrowser.getName(this), 'browserGotoRoot', { 
      distanceFromRoot, 
      stackLen        : this.urlStack.length, 
      browserStackLen : this.browserStack.length
    })

    this.codePop = true
    this.historyWrapper.go(distanceFromRoot)
  }

  /*--------------------------------------------------------------------------------------------------------------
    Register components for reference by rest of the system
  --------------------------------------------------------------------------------------------------------------*/

  public registerComponent(compName: string, component) {

    const oldComponent = this.componentRegistry[compName]
    if (oldComponent === component) return

    this.componentRegistry[compName] = component
    this.rcBrowser.isStatus() && this.rcBrowser.status(this.rcBrowser.getName(this), 
      'Registered component with name', compName)
  }

  public getComponent(compName: string) {
    return this.componentRegistry[compName]
  }

  public onMubbleScreenChange(url: string, outlet: OUTLET, lastNavMethod: NavMethod) {
  
  }

  public onMubbleScreenNavEnd(url: string, lastNavMethod: NavMethod) {

  }

  public notifyUserBackPress() : boolean {
    return true
  }
  
  public notifyAppClose() {

  }

  public isToolTipShown() : boolean {
    return true
  }
}

class HistoryWrapper {

  constructor(private rc) {
    rc.setupLogger(this, 'HistoryWrapper')
  }

  pushState(state: Mubble.uObject<any>, title: string, url: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'before pushState', {
      historyLength : history.length, 
      historyState  : history.state,
      newState      : state
    })
    history.pushState(state, title, url)
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'after pushState', {
      historyLength : history.length, 
      historyState  : history.state
    })
  }

  replaceState(state: Mubble.uObject<any>, title: string, url: string) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'before replaceState', {
      historyLength : history.length, 
      historyState  : history.state,
      title         : title,
      url           : url,
      newState      : state
    })
    history.replaceState(state, title, url)
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'after replaceState', {
      historyLength : history.length, 
      historyState  : history.state
    })
  }

  go(delta: number) {
    history.go(delta)
  }

  getState() {
    return history.state
  }

  getLength() {
    return history.length
  }

}