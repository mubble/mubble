/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { XmnEvent, XmnRequest, XmnResponse, 
         MubbleWebSocket, STATUS}  from '@mubble/core'


// class WebSocketWrap extends BaseWs {

//   private ws : WebSocket

//   constructor(url: string) {
//     super()
//     this.ws = new WebSocket(url)
//   }

//   mapEvents(mws: MubbleWebSocket) : void {

//     this.ws.onopen = () => {
//       logger.isStatus() && logger.status('Websocket connected')
//       mws.onOpen()
//     }

//     this.ws.onmessage = (msgEvent: MessageEvent) => {
//       mws.onMessage(msgEvent.data)
//     }

//     this.ws.onclose = (closeEvent: CloseEvent) => {
//       logger.isStatus() && logger.status('Websocket closed', closeEvent)
//       mws.onClose()
//     }

//     this.ws.onerror = (err: any) => {
//       logger.isWarn() && logger.warn('Websocket received error', err)
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



export class BrowserWs {

  static url : string

  static init(appName: string, version: string, host: string, port ?: number) {
    BrowserWs.url = MubbleWebSocket.getWsUrl(appName, version, host, port)
  }

  getSocket(): MubbleWebSocket {
    return new MubbleWebSocket(new WebSocket(BrowserWs.url))
  }
}

