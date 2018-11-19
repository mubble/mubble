/*------------------------------------------------------------------------------
   About      : Any component be it routable or not which needs to be tracked 
                for analytics must extent this class. All actions performed 
                on sub components / HTML elements in this kind of component 
                will be logged under the trackable screen name.

   Created on : Sat Nov 03 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { ComponentRoute }    from '../../../../framework/ui-router/pz-ui-router-constants'
import { RunContextBrowser } from '@mubble/browser/rc-browser'
 
export abstract class TrackableScreen  {
  
  abstract isUserVisited(): boolean
  abstract getRouteName(): string
  
  constructor(protected rc : RunContextBrowser) {

  }

  onApiComplete(success: boolean) {
    
  }

  ngOnDestroy() {

    if (this.rc.userKeyVal.clientId && this.isUserVisited()) {
      const key = Object.keys(ComponentRoute)
        .find(key => ComponentRoute[key] === this.getRouteName())

       this.rc.userKeyVal.setScreenVisited(key)
    }
  }

}