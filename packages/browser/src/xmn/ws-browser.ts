/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { XmnRouter,
         MubbleWebSocket}  from '@mubble/core'

import {RunContextBrowser} from '../rc-browser'

export class BrowserWs {

  static url : string

  static init(appName: string, version: string, host: string, port ?: number) {
    BrowserWs.url = MubbleWebSocket.getWsUrl(appName, version, host, port)
  }

  getSocket(rc: RunContextBrowser, router: XmnRouter): MubbleWebSocket {
    return new MubbleWebSocket(rc, new WebSocket(BrowserWs.url), router)
  }
}

