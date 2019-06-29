/*------------------------------------------------------------------------------
   About      : Any component which can be directly routed to must extent to 
                this class. This kind of component is a screen. All actions 
                performed on sub components / HTML elements in this kind of 
                component will be logged under the trackable screen name.

   Created on : Sat Nov 03 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { TrackableScreen }    from './trackable-screen'
import { RunContextBrowser }  from '../../rc-browser'
import { Mubble }             from '@mubble/core'

export abstract class RoutableScreen extends TrackableScreen {

  abstract onRouterInit(queryParams: Mubble.uObject<any>, firstInvocation: boolean): void
  
  constructor(protected rc: RunContextBrowser) {
    super(rc)
  }
} 