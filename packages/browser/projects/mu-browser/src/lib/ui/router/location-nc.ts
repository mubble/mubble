/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Jul 12 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { LocationChangeListener, PlatformLocation } from '@angular/common'
import { Inject, Injectable }                       from '@angular/core'

import { RunContextBrowser, LOG_LEVEL }             from '../../rc-browser'

@Injectable()
export class NcPlatformLocation extends PlatformLocation {

  constructor(@Inject('RunContext') private rc: RunContextBrowser) {
    super()
    rc.setupLogger(this, 'NcPlatformLocation')
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'constructor()')
  }

  get location(): Location {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'get location()')
    return location
  }


  getState() {

  }

  getBaseHrefFromDOM(): string {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'getBaseHrefFromDOM()')
    return '.'
  }

  onPopState(fn: LocationChangeListener): void {
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onPopState() ignored')
    // window.addEventListener('popstate', fn, false);
  }

  onHashChange(fn: LocationChangeListener): void {
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onHashChange() ignored')
    // window.addEventListener('hashchange', fn, false);
  }


  get hostname() {
    return  location.hostname
  }

  get port() {
    return  location.port
  }

  get href() {
    return  location.href
  }

  get protocol() {
    return  location.protocol
  }


  get pathname(): string { 
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'get pathname()')
    return location.pathname 
  }

  get search(): string { 
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'get search()')
    return location.search
  }

  get hash(): string { 
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'get hash()')
    return location.hash 
  }

  set pathname(newPath: string) { 
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'set pathname()')
    // location.pathname = newPath 
  }

  pushState(state: any, title: string, url: string): void {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), false, 
      'pushState', 'First navigation was not done in root ngInit()')
  }

  replaceState(state: any, title: string, url: string): void {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), false, 'replaceState', 
     'First navigation was not done in root ngInit()')
  }

  forward(): void { 
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'forward()')
    // history.forward()
  }

  back(): void { 
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'back()')
    // history.back()
  }

}