/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/



/*------------------------------------------------------------------------------
Websocket communication is essentially about following types:

  - A client (or server) event
  - A client (or server) request

Some events may need acknowledgement from the other party, These can essentially be 
assumed to be of type request / response. We will not use the term event for them.

The underlying architecture can work on promises for request/response, which is 
logically same as what we will have for http based request response.

The event mechanism will be just like send it and forget it, this will actually be 
like request with no response, leading to simpler apis and less network communication

It may be possible that large message has not been flushed out on the websocket when 
the next message arrives. We will need to ensure that we handle this.

It will also be possible to reuse the code between client and server. More importantly
we will just need to abstract out ws node library.

Following steps are followed during setup and communication:
- connect (sends app version and key)
- upgrade (sends new key as cookie)
- Connected (req/resp or events can flow now)

Request:
{type:request api:name clientTs:curTime seq:uniqSequenceId data:{} }

http side note: If some third party is sending us json array, we should translate that
to {array: []}

Response:
{type:response seq:uniqSequenceId error:null data:{} }

Errors like invalid_uid_pwd will not be sent in the error fields anymore. Error essentially
should be at the level of communication layer to indicate that request has failed

Event:
{type: event, name:eventName, eventTs:eventCreateTs  data:{} }

Special event for upgrade (server to client): 
Open another websocket to receive product version upgrade. This protocol
will be defined later.


------------------------------------------------------------------------------*/
enum REQUEST_OR_EVENT {
  REQUEST, EVENT
}

export interface XmnRequest {
  type  : 'request'
  api   : string
  seq   : number
  data  : object
}

export interface XmnResponse {
  type  : 'response'
  seq   : number
  error : string | null
  data  : object
}

export interface XmnEvent {
  type    : 'event'
  name    : string
  eventTs : number
  data    : object
}

export interface XmnRouter {
  routeEvent(id: string, eventTs: number, data: object): void
  routeRequest(api: string, data: object): any
}

export enum STATUS {
  CONNECTING, OPEN, CLOSED
}

const CONST = {
  APP: 'APP',
  VER: 'VER'
}

export const ERROR = {
  NOT_CONNECTED: 'NOT_CONNECTED'
}

// export abstract class BaseWs {

//   abstract mapEvents(mws: MubbleWebSocket)    : void
//   abstract getStatus()                        : STATUS
//   abstract bufferedAmount                 : number
//   abstract sendRequest(request: XmnRequest)   : void
//   abstract sendResponse(request: XmnResponse) : void
//   abstract sendEvent(event: XmnEvent)         : void
//   abstract close(msg: any)                    : void

// }

enum REQUEST_STATUS {
  TO_BE_SENT, SENT, ROUTED
}

declare const setInterval: any, clearInterval: any, console : any

class Pending {

  static nextSendRequestId : number = 1
  static nextSendEventId   : number = Number.MAX_SAFE_INTEGER

  constructor(public reqOrEvent: REQUEST_OR_EVENT, public name: string, 
              public data : object | undefined, public status: REQUEST_STATUS, 
              public seq: number, public resolve: any, public reject: any) {

  }
}

export class MubbleWebSocket {

  static getWsUrl(appName: string, version: string, host: string, port ?: number) {

    return `ws://${host}${port ? ':' + port : ''}/socket.io?${MubbleWebSocket.encodeParams({
      [CONST.APP] : appName,
      [CONST.VER] : version
    })}`

  }

  static encodeParams(params: object) {
    return Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent((params as any)[k]))
    .join('&');    
  }

  private mapPending: Map<number, Pending> = new Map()
  private timer: any

  constructor(private platformWs : any, private router : XmnRouter) {
    platformWs.onopen     = this.onOpen.bind(this)
    platformWs.onmessage  = this.onMessage.bind(this)
    platformWs.onclose    = this.onClose.bind(this)
    platformWs.onerror    = this.onError.bind(this)
  }

  onOpen() {
    this.timer = setInterval(this.housekeep.bind(this), 1000)
  }

  onMessage(msg: any) {

    try {
      const incomingMsg = JSON.parse(msg)
      if (incomingMsg.type === 'request') {
        this.router.routeRequest(incomingMsg.api, incomingMsg.data)
        // TODO: this is to be added to pending
      } else {
        this.router.routeEvent(incomingMsg.name, incomingMsg.eventTs, incomingMsg.data)
      }
    } catch (err) {
      return console.error('got invalid message', msg)
    }
  }

  onClose() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

  }

  onError(err: any) {


  }

  getStatus() {
    switch (this.platformWs.readyState) {

    case this.platformWs.CONNECTING:
      return STATUS.CONNECTING

    case this.platformWs.OPEN:
      return STATUS.OPEN
    }
    // case this.platformWs.CLOSING:
    // case this.platformWs.CLOSED:
    return STATUS.CLOSED
  }

  sendRequest(apiName: string, data: object) {

    return new Promise((resolve, reject) => {
      const status = this.getStatus()
      if (status === STATUS.CLOSED) {
        return reject(new Error(ERROR.NOT_CONNECTED))
      }

      const reqId = Pending.nextSendRequestId


      if (status === STATUS.CONNECTING || this.platformWs.bufferedAmount > 0) {

        this.mapPending.set(reqId, 
          new Pending(REQUEST_OR_EVENT.REQUEST, apiName, data, REQUEST_STATUS.TO_BE_SENT, 
                      Pending.nextSendRequestId++, resolve, reject))

      } else {

        this.platformWs.send(JSON.stringify({
          type  : 'request',
          api   : apiName,
          data  : data,
          seq   : reqId
        }))

        // TODO: Set the start time for cleanup
        this.mapPending.set(reqId, 
          new Pending(REQUEST_OR_EVENT.REQUEST, apiName, undefined, REQUEST_STATUS.SENT, 
                      Pending.nextSendRequestId++, resolve, reject))

      }
    })

  }

  sendEvent(name: string, eventTs: number, data: object) {

    return new Promise((resolve, reject) => {
      
      const status = this.getStatus()
      if (this.getStatus() === STATUS.CLOSED) {
        return reject(new Error(ERROR.NOT_CONNECTED))
      }

      if (status === STATUS.CONNECTING || this.platformWs.bufferedAmount > 0) {

        this.mapPending.set(Pending.nextSendEventId, 
          new Pending(REQUEST_OR_EVENT.EVENT, name, data, REQUEST_STATUS.TO_BE_SENT, 
          Pending.nextSendEventId--, resolve, reject))

      } else {

        this.platformWs.send(JSON.stringify({
          type    : 'event',
          name    : name,
          eventTs : eventTs,
          data    : data
        }))
      }
    })
  }

  private housekeep() {

    const status = this.getStatus()
    this.mapPending.forEach((pending, key) => {
      if (status === STATUS.CLOSED) {
        if (pending.status === REQUEST_STATUS.SENT || pending.status === REQUEST_STATUS.TO_BE_SENT) {
          pending.reject(new Error(ERROR.NOT_CONNECTED))
        }
        this.mapPending.delete(key)
      } else if (status === STATUS.OPEN && this.platformWs.bufferedAmount === 0) {
        if (pending.status === REQUEST_STATUS.TO_BE_SENT) {
          if (pending.reqOrEvent === REQUEST_OR_EVENT.REQUEST) {
            this.platformWs.send(JSON.stringify({
              type  : 'request',
              api   : pending.name,
              data  : pending.data as object,
              seq   : pending.seq
            }))
            pending.data   = undefined
            pending.status = REQUEST_STATUS.SENT
          } else {
            this.platformWs.send(JSON.stringify({
              type    : 'event',
              name    : pending.name,
              data    : pending.data as object,
              eventTs : 0 // TODO: this is a bug!!!!!
            }))
            this.mapPending.delete(key)
          }
        }
      }
    })
  }
}