/*------------------------------------------------------------------------------
   About      : Websocket based communication manager
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import * as http from 'http'
import * as ws   from 'ws'
import { XmnRouter,  
         MubbleWebSocket, STATUS}  from '@mubble/core'

import {RunContextServer, RUN_MODE} from '../rc-server'

export class WsXmn {

  private rc: RunContextServer // TODO: bad hack
  private wsServer : ws.Server
  private sockets  :  MubbleWebSocket[] = []

  constructor(rc: RunContextServer, httpServer: http.Server, private router: XmnRouter) {

    this.rc = rc // TODO: ???? Hack

    this.wsServer = new ws.Server({
      server: httpServer,
      verifyClient: this.onVerifyClient.bind(this)
    })
    this.wsServer.on('connection', this.onConnection.bind(this))
    this.wsServer.on('headers'   , this.onHeaders.bind(this))
  }

  onConnection(socket : WebSocket) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'got a new connection')
    const mws = new MubbleWebSocket()
    mws.init(this.rc, socket, this.router)
    this.sockets.push(mws)
    // TODO: Need to cleanup socket via timer and notification ????
  }

  onVerifyClient(info: { origin: string; secure: boolean; req: http.IncomingMessage }, 
    cb: (res: boolean) => void) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onVerifyClient', info)
    return cb(true)
  }

  onHeaders(headers: string[]) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'headers', headers)
  }
}

