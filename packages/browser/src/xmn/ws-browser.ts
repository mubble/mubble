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

  static init(appName: string, version: string, host: string, port ?: number): void {
    BrowserWs.url = MubbleWebSocket.getWsUrl(appName, version, host, port)
  }

  static async getSocket(rc: RunContextBrowser, router: XmnRouter): Promise<MubbleWebSocket> {

    const mws = new MubbleWebSocket(),
          ws  = new WebSocket(BrowserWs.url)

    if (!BrowserWs.url) {
      rc.isError() && rc.error(rc.getName(this), 'Forgot to do BrowserWs.init? No url')
      return null
    }

    await mws.init(rc, ws, router)
    return mws
  }
}

