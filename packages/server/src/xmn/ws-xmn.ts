/*------------------------------------------------------------------------------
   About      : Websocket based communication manager
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http from 'http'
import * as ws   from 'ws'
import { XmnEvent, XmnRequest, XmnResponse, 
         MubbleWebSocket, BaseWs, STATUS}  from '@mubble/core'

import {router} from '../router/router'

import {RunContext} from '../util/run-context'
let rc: RunContext // TOOD: bad hack

class ServerSocketWrap extends BaseWs {

  constructor(private ws : any) {
    super()
  }

  mapEvents(mws: MubbleWebSocket) : void {

    this.ws.onopen = () => {
      rc.isStatus() && rc.status(this.constructor.name, 'Websocket connected')
      mws.onOpen()
    }

    this.ws.onmessage = (msgEvent: any) => {
      mws.onMessage(msgEvent.data)
    }

    this.ws.onclose = (closeEvent: any) => {
      rc.isStatus() && rc.status(this.constructor.name, 'Websocket closed', closeEvent)
      mws.onClose()
    }

    this.ws.onerror = (err: any) => {
      rc.isWarn() && rc.warn(this.constructor.name, 'Websocket received error', err)
      mws.onError(err)
    }
  }

  getStatus() : STATUS {

    switch (this.ws.readyState) {

    case this.ws.CONNECTING:
      return STATUS.CONNECTING

    case this.ws.OPEN:
      return STATUS.OPEN
    }
    // case this.ws.CLOSING:
    // case this.ws.CLOSED:
    return STATUS.CLOSED

  }

  getBufferedBytes() : number {
    return this.ws.bufferedAmount
  }

  sendRequest(request: XmnRequest): void {
    this.ws.send(JSON.stringify(request))
  }

  sendResponse(request: XmnResponse): void {
    this.ws.send(JSON.stringify(request))
  }

  sendEvent(event: XmnEvent): void {
    this.ws.send(JSON.stringify(event))
  }

  close(): void {
    this.ws.close()
  }
}


export class WsXmn {

  private wsServer : ws.Server
  private sockets  :  MubbleWebSocket[] = []

  constructor(httpServer: http.Server) {

    rc = RunContext.getNew('WsXmn')
    this.wsServer = new ws.Server({server: httpServer})

    this.wsServer.on('connection', (socket : any) => {
      const rc = RunContext.getAdHoc()
      rc.isDebug() && rc.debug(this.constructor.name, 'got a new connection')
      const ssw = new ServerSocketWrap(socket)
      this.sockets.push(new MubbleWebSocket(ssw, router))
    })
  }
}

/*------------------------------------------------------------------------------
  ClientSockets
------------------------------------------------------------------------------*/
// class ClientSocket  {
  
//   constructor(private socket: any) {
//     RunContext.on('WsMsg'   , socket, 'message', this.message.bind(this))
//     RunContext.on('WsClose' , socket, 'close'  , this.close.bind(this))
//     RunContext.on('WsError' , socket, 'error'  , this.error.bind(this))
//   }

//   message(rc: RunContext, msg: any, binary: boolean) {
//     rc.isStatus() && rc.status(this.constructor.name, 'Received message', msg)
//   }

//   close(rc: RunContext, code: number, message: string) {
//   }

//   error(rc: RunContext, err: Error) {
    
//   }
// }



