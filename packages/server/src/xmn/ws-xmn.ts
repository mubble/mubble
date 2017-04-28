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

let rc: RunContextServer // TODO: bad hack

// class ServerSocketWrap extends BaseWs {

//   constructor(private ws : any) {
//     super()
//   }

//   mapEvents(mws: MubbleWebSocket) : void {

//     this.ws.onopen = () => {
//       rc.isStatus() && rc.status(this.constructor.name, 'Websocket connected')
//       mws.onOpen()
//     }

//     this.ws.onmessage = (msgEvent: any) => {
//       mws.onMessage(msgEvent.data)
//     }

//     this.ws.onclose = (closeEvent: any) => {
//       rc.isStatus() && rc.status(this.constructor.name, 'Websocket closed', closeEvent)
//       mws.onClose()
//     }

//     this.ws.onerror = (err: any) => {
//       rc.isWarn() && rc.warn(this.constructor.name, 'Websocket received error', err)
//       mws.onError(err)
//     }
//   }

//   getStatus() : STATUS {

//     switch (this.ws.readyState) {

//     case this.ws.CONNECTING:
//       return STATUS.CONNECTING

//     case this.ws.OPEN:
//       return STATUS.OPEN
//     }
//     // case this.ws.CLOSING:
//     // case this.ws.CLOSED:
//     return STATUS.CLOSED

//   }

//   getBufferedBytes() : number {
//     return this.ws.bufferedAmount
//   }

//   sendRequest(request: XmnRequest): void {
//     this.ws.send(JSON.stringify(request))
//   }

//   sendResponse(request: XmnResponse): void {
//     this.ws.send(JSON.stringify(request))
//   }

//   sendEvent(event: XmnEvent): void {
//     this.ws.send(JSON.stringify(event))
//   }

//   close(): void {
//     this.ws.close()
//   }
// }


export class WsXmn {

  private wsServer : ws.Server
  private sockets  :  MubbleWebSocket[] = []

  constructor(rc: RunContextServer, httpServer: http.Server, router: XmnRouter) {

    this.wsServer = new ws.Server({server: httpServer})

    this.wsServer.on('connection', (socket : any) => {
      rc.isDebug() && rc.debug(this.constructor.name, 'got a new connection')
      this.sockets.push(new MubbleWebSocket(rc, socket, router))
      // TODO: Need to cleanup socket via timer and notification ????
    })
  }
}

/*------------------------------------------------------------------------------
  ClientSockets
------------------------------------------------------------------------------*/
// class ClientSocket  {
  
//   constructor(private socket: any) {
//     RunContextServer.on('WsMsg'   , socket, 'message', this.message.bind(this))
//     RunContextServer.on('WsClose' , socket, 'close'  , this.close.bind(this))
//     RunContextServer.on('WsError' , socket, 'error'  , this.error.bind(this))
//   }

//   message(rc: RunContextServer, msg: any, binary: boolean) {
//     rc.isStatus() && rc.status(this.constructor.name, 'Received message', msg)
//   }

//   close(rc: RunContextServer, code: number, message: string) {
//   }

//   error(rc: RunContextServer, err: Error) {
    
//   }
// }



