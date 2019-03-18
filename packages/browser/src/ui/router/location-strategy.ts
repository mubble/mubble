/*------------------------------------------------------------------------------
   About      : As we have implemented our own history wrapper, this class
                prevents angular from  mainpulating history 
   
   Created on : Sun Mar 17 2019
   Author     : Aditya Baddur
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/


import { Injectable, 
         Inject
       }                        from '@angular/core'
import { LocationStrategy,
         LocationChangeListener
       }                        from '@angular/common'
import { RunContextBrowser }    from '@mubble/browser/rc-browser'

@Injectable()
export class AppLocationStrategy extends LocationStrategy {

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) {
    super()
  }

  getBaseHref() {
    return '.'
  }

  path() {
    return location.pathname
  }

  prepareExternalUrl() {
    return ''
  }

  onPopState(fn: LocationChangeListener) {
    
  }

  pushState(state: any, title: string, path: string, queryParams: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `ignoring push state 
      ${state} , ${title}, ${path}, ${queryParams}`)
  }

  replaceState(state: any, title: string, path: string, queryParams: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `ignoring replace state
      ${state} , ${title}, ${path}, ${queryParams}`)
  }

  forward() {

  }

  back() {

  }

}