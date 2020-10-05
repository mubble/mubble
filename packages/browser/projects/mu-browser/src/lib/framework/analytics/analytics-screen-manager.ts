/*------------------------------------------------------------------------------
   About      : Class responsible for creation, manitenance and destruction of 
                screen state for analytics in between navigationd from any one 
                router-outlet to another.

   Created on : Sat Nov 03 2018
   Author     : Sid

   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser }                      from '../../rc-browser'
import { AnalyticsScreenInfo }                from './analytics-screen-info'
import { NavMethod, 
         DIRECTION, 
         OUTLET, 
         MODAL_OUTLET
       }                                      from '../../ui'
import { EventSystem }                        from '../../util'
import { LOG_LEVEL }                          from '@mubble/core'

const NavMode = {
  Launch  : 'page_launch',
  Next    : 'page_next',
  Back    : 'page_back',
  Dialog  : 'page_dialog'
}

const INVOCATION_LAUNCH   = 'launch'
const INVOCATION_RELAUNCH = 'relaunch'

export class AnalyticsScreenManager {

  private currScreenState     : AnalyticsScreenInfo
  private currModalState      : AnalyticsScreenInfo

  private currTabScreenState  : AnalyticsScreenInfo
  private currTabRoutes       : string[]

  private lastModalName       : string
  private lastTabSceenName    : string
  private lastScreenName      : string

  private pendingTabActions = {}
  private pendingTabStates  = {}

  constructor(private rc: RunContextBrowser) {

    rc.setupLogger(this, 'AnalyticsScreenManager')
    this.lastScreenName = ''
    this.currModalState = null

    // EventSystem.subscribe(APP_UI_EVENT.CORDOVA_SCREEN_PAUSE, this.onScreenPause.bind(this))
    // EventSystem.subscribe(APP_UI_EVENT.CORDOVA_SCREEN_RESUME, this.onScreenResume.bind(this))
    if (rc.getGlobalLogLevel() === LOG_LEVEL.DEBUG)  window['screenmanager'] = this
  }

  getCurrentScreenName(): string {

    return this.currModalState != null ? this.currModalState.getScreenName()
                                       : this.currScreenState.getScreenName()
  }

  onNavEnd(eventUrl: string, outlet: OUTLET, lastNavMethod: NavMethod) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'Inside onNavEnd', eventUrl, lastNavMethod)

    let screenName: string

    if (eventUrl.startsWith('/')) {
      screenName = this.getFbaseScreenName(eventUrl.substring(1))
      this.rc.isStatus() && this.rc.status(this.rc.getName(this), 
        'Found screenName: ', screenName)
    }

    if (this.lastScreenName === screenName) {
      // Same page is invoked but with diff query params..add stay time
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'Same page invoked, Ignoring...')

      if (this.currModalState) {
        this.currModalState.onScreenDestroy()
        this.currModalState = null
      }
      return
    }

    // Handling modal outlet
    if (outlet === MODAL_OUTLET) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
        this.currModalState === null, 'Already tracking a modal...')

      let modalName: string = eventUrl.match(/.*=\((.*)\)/)[1]
      modalName = this.getFbaseScreenName(modalName)
      
      this.currModalState = new AnalyticsScreenInfo(this.rc, modalName, 
        this.currScreenState.getScreenName(), NavMode.Dialog, true)
      
      this.lastModalName = eventUrl
      return

    } else if (this.currModalState) {
      this.currModalState.onScreenDestroy()
      this.currModalState = null
    }

    let navMode : string 
    let invSrc  : string

    if (this.currScreenState) {
      this.currScreenState.onScreenDestroy()
      navMode = lastNavMethod === NavMethod.POP ? NavMode.Back : NavMode.Next
      invSrc  = this.currTabScreenState ? this.currTabScreenState.getScreenName() 
                                        : this.currScreenState.getScreenName()
    } else {
      navMode = NavMode.Launch
      invSrc  = INVOCATION_LAUNCH
    }

    this.currScreenState = new AnalyticsScreenInfo(this.rc, screenName, invSrc, navMode)
    this.lastScreenName = screenName
  }

  setCurrentTabRoutes(tabRoutes: string[]) {
    this.currTabRoutes = tabRoutes
  }

  onTabNavEnd(currScreenName : string, tabIndex : number) {

    const tabScreenName = this.getFbaseScreenName(currScreenName)

    if (this.currTabScreenState)  this.currTabScreenState.onScreenDestroy()

    this.lastTabSceenName   = this.currTabRoutes[tabIndex]
    const invSource         = this.currTabScreenState ? this.currTabScreenState.getScreenName() 
                                                      : INVOCATION_LAUNCH
    this.currTabScreenState = new AnalyticsScreenInfo(this.rc, tabScreenName, invSource)

    this.digestPendingTabScreen(tabIndex)
  }

  onTabDestroy() {
    this.currTabScreenState.onScreenDestroy()
    this.currTabScreenState = null
  }

  logScreenActionScroll(screenName: string, direction: DIRECTION) {
    
    screenName = this.getFbaseScreenName(screenName)

    if (this.currModalState && this.currModalState.getScreenName() === screenName) {
      this.currModalState.setScreenActionScroll(direction)
    } else {
      this.currScreenState.setScreenActionScroll(direction)
    }
  }

  logScreenAction(screenName: string, actionName: string) {

    screenName = this.getFbaseScreenName(screenName)

    if (this.currModalState && this.currModalState.getScreenName() === screenName) {
      this.currModalState.setScreenAction(actionName)

    } else if (this.currScreenState.getScreenName() === screenName) {
      this.currScreenState.setScreenAction(actionName)

    } else if (this.currTabRoutes) {
      this.onTabScreenAction(screenName, actionName)

    } else {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), false, 
        'Invalid screen action', screenName, actionName, 'Expected screen', this.currScreenState.getScreenName())
    }
  }

  logScreenState(screenName: string, stateName: string, stateValue: number | string) {

    screenName = this.getFbaseScreenName(screenName)
    
    if (this.currModalState && this.currModalState.getScreenName() === screenName) {
      this.currModalState.setScreenState(stateName, stateValue)

    } else if (this.currScreenState.getScreenName() === screenName) {
      this.currScreenState.setScreenState(stateName, stateValue)
    
    } else if (this.currTabRoutes) {
      this.onTabScreenState(screenName, stateName, stateValue)
    } else {
      this.rc.isError() && this.rc.error(this.rc.getName(this), 
      `Invalid screen state', ${screenName}, ${stateName}, 'Expected screen name ', ${this.currScreenState.getScreenName()}`)
    }
  }

  private onTabScreenAction(screenName: string, actionName: string) {

    if (this.lastTabSceenName === screenName && this.currTabScreenState) {
      this.currTabScreenState.setScreenAction(actionName)

    } else {

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      this.currTabRoutes.indexOf(screenName) !== -1, 
      `invalid tab screen name ${screenName} ${actionName}`)

      let actions: string[] = this.pendingTabActions[screenName]
      if (!actions) actions = []
      actions.push(actionName)
      this.pendingTabActions[screenName] = actions
    }
  }

  private onTabScreenState(screenName: string, stateName: string, stateValue: number | string) {

    if (this.lastTabSceenName === screenName && this.currTabScreenState) {
      this.currTabScreenState.setScreenState(stateName, stateValue)

    } else {

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      this.currTabRoutes.indexOf(screenName) !== -1, 
      `invalid tab screen name ${screenName} ${stateName}`)

      let routeTabState = this.pendingTabStates[screenName]
      if (!routeTabState) routeTabState = {}
      routeTabState[stateName] = stateValue
      this.pendingTabStates[screenName] = routeTabState
    }
  }

  private digestPendingTabScreen(tabIndex: number) {

    const currScreenName  = this.currTabRoutes[tabIndex]
    // Digest route Actions
    const actions: string[] = this.pendingTabActions[currScreenName]
    if (actions) {
      actions.forEach(action => {
        this.currTabScreenState.setScreenAction(action)
      })
      this.pendingTabActions[currScreenName] = []
    }
    
    // Digest route States
    const states = this.pendingTabStates[currScreenName]
    if (states) {
      for (let key in states) {
        this.currTabScreenState.setScreenState(key, states[key])
      }
      this.pendingTabStates[currScreenName] = {}
    }
  }

  onScreenPause() {

    if (this.currModalState) this.currModalState.onScreenDestroy()
    if (this.currTabScreenState) this.currTabScreenState.onScreenDestroy()
    this.currScreenState.onScreenDestroy()
  }

  private onScreenResume() {

    if (this.currModalState) this.currModalState = new AnalyticsScreenInfo(this.rc, 
        this.currModalState.getScreenName(), this.currModalState.getInvocationSource(), 
        INVOCATION_RELAUNCH, true)

    if (this.currTabScreenState) this.currTabScreenState = new AnalyticsScreenInfo(this.rc, 
      this.currTabScreenState.getScreenName(), this.currTabScreenState.getInvocationSource(), 
      INVOCATION_RELAUNCH)

    this.currScreenState = new AnalyticsScreenInfo(this.rc, this.currScreenState.getScreenName(), 
        this.currScreenState.getInvocationSource(), INVOCATION_RELAUNCH)
  }

  private getFbaseScreenName(url: string) {

    let screenName
    const paramIdx = url.indexOf('?')
    screenName = url.substring(0, paramIdx > 0 ? paramIdx : url.length).replace('%2F', '/')
    
    const moduleIdx = screenName.indexOf('/')
    if (moduleIdx !== -1) screenName = screenName.substring(moduleIdx + 1, screenName.length)

    return screenName
  }
}