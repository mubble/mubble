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
    // this.wsServer.on('headers'   , this.onHeaders.bind(this))
  }

  onConnection(socket : any) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onConnection')

    // const req       = socket.upgradeReq,
    //       urlObj    = url.parse(req.url || ''),
    //       queryObj  = querystring.parse(urlObj.query),
    //       ic        = this.router.getNewInConnection(this.rc)

    // ic.params = JSON.parse(queryObj[WS_CONST.CONNECTION_KEY])
    // ic.verifyConnection(this.rc).then(() => {
    //   const mws = new MubbleWebSocket()
    //   mws.init(this.rc, socket, this.router, ic)
    //   this.sockets.push(mws)
    //   // TODO: Need to cleanup socket via timer and notification ????
    // }, (err) => {
    //   socket.close();
    //   this.rc.isError() && this.rc.error(this.rc.getName(this), 'Ignoring socket as could not find request')
    // })



    const index = this.store.findIndex(item => item.req === socket.upgradeReq)
    if (index === -1) {
      socket.close();
      return this.rc.isError() && this.rc.error(this.rc.getName(this), 'Ignoring socket as could not find request')
    }
    const temp:TempStoreEntry|undefined = this.store[index]
    this.store.splice(index, 1)

    const mws = new MubbleWebSocket()
    mws.init(this.rc, socket, this.router, temp.ic)
    this.sockets.push(mws)
  }

  onVerifyClient(info: { origin: string; secure: boolean; req: http.IncomingMessage }, 
    cb: (res: boolean) => void) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onVerifyClient')

    const urlObj    = url.parse(info.req.url || ''),
          queryObj  = querystring.parse(urlObj.query),
          ic        = this.router.getNewInConnection(this.rc)

    ic.params = JSON.parse(queryObj[WS_CONST.CONNECTION_KEY])
    ic.verifyConnection(this.rc).then(() => {
      this.store.push({
        ts: Date.now(),
        req: info.req, 
        ic
      })
      cb(true)
    }, (err) => {
      this.rc.isError() && this.rc.error(this.rc.getName(this), 'onVerifyClient failed', err)
      cb(false)
    })
  }

  // onHeaders(headers: string[], req: http.IncomingMessage) {

  //   this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onHeaders', req)

  //   const temp:TempStoreEntry|undefined = lo.find(this.store, {req})
  //   if (temp) {
  //     const cookieStr = `Set-Cookie: ${WS_CONST.CONNECTION_KEY}=${
  //       encodeURIComponent(JSON.stringify(temp.resp))}`
  //     this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'setting cookie', cookieStr)
  //     headers.push(cookieStr)
  //   }

  // }
}

