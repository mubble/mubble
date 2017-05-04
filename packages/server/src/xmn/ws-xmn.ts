/*------------------------------------------------------------------------------
   About      : Websocket based communication manager
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import * as http          from 'http'
import * as ws            from 'ws'
import * as url           from 'url'
import * as querystring   from 'querystring'
import * as lo            from 'lodash'

import { XmnRouter, InConnectionBase,
         MubbleWebSocket, WS_CONST}  from '@mubble/core'

import {RunContextServer, RUN_MODE} from '../rc-server'

interface TempStoreEntry {
  ts    : number
  req   : http.IncomingMessage
  resp  : object,
  ic    : InConnectionBase
}

export class WsXmn {

  private rc: RunContextServer // TODO: bad hack
  private wsServer : ws.Server
  private sockets  :  MubbleWebSocket[] = []
  private store    : TempStoreEntry[] = []

  constructor(rc: RunContextServer, httpServer: http.Server, private router: XmnRouter) {

    this.rc = rc // TODO: ???? Hack

    this.wsServer = new ws.Server({
      server: httpServer,
      verifyClient: this.onVerifyClient.bind(this)
    })
    this.wsServer.on('connection', this.onConnection.bind(this))
    this.wsServer.on('headers'   , this.onHeaders.bind(this))
  }

  onConnection(socket : any) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'got a new connection')
    const mws = new MubbleWebSocket()

    const temp:TempStoreEntry|undefined = lo.find(this.store, {req: socket.upgradeReq})
    if (temp) {
      mws.init(this.rc, socket, this.router, temp.ic)
      this.sockets.push(mws)
      // TODO: Need to cleanup socket via timer and notification ????
    } else {
      socket.close();
      this.rc.isError() && this.rc.error(this.rc.getName(this), 'Ignoring socket as could not find request')
    }
  }

  async onVerifyClient(info: { origin: string; secure: boolean; req: http.IncomingMessage }, 
    cb: (res: boolean) => void) {

    const urlObj    = url.parse(info.req.url || ''),
          queryObj  = querystring.parse(urlObj.query),
          ic        = this.router.getNewInConnection(this.rc)
    

    ic.params = JSON.parse(queryObj[WS_CONST.CONNECTION_COOKIE])
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'ic.params', ic.params)
    
    try {
      const resp = await ic.verifyConnection(this.rc)
      this.store.push({
        ts: Date.now(),
        req: info.req, ic, resp
      })
      cb(true)
    } catch (err) {
      this.rc.isError() && this.rc.error(this.rc.getName(this), 'onVerifyClient failed', err)
      cb(false)
    }

  }

  onHeaders(headers: string[], req: http.IncomingMessage) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onHeaders', req)

    const temp:TempStoreEntry|undefined = lo.find(this.store, {req})
    if (temp) {
      const cookieStr = `Set-Cookie: ${WS_CONST.CONNECTION_COOKIE}=${
        encodeURIComponent(JSON.stringify(temp.resp))}`
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'setting cookie', cookieStr)
      headers.push(cookieStr)
    }

  }
}

