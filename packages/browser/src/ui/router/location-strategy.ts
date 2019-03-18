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
import { HashLocationStrategy, 
         PlatformLocation 
       }                        from '@angular/common'
import { RunContextBrowser }    from '@mubble/browser/rc-browser'

@Injectable()
export class AppLocationStrategy extends HashLocationStrategy {

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              protected platformLocation          : PlatformLocation) {
    super(platformLocation)
  }

  pushState(state: any, title: string, path: string, queryParams: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `ignoring push state 
      ${state} , ${title}, ${path}, ${queryParams}`)
  }

  replaceState(state: any, title: string, path: string, queryParams: string) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `ignoring replace state
      ${state} , ${title}, ${path}, ${queryParams}`)
  }

}