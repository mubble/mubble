/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 29 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export enum Protocol {HTTP, WEBSOCKET, HTTPS}

export const NetworkType = {
  net2G   : '2G',
  net3G   : '3G',
  net4G   : '4G',
  net5G   : '5G',
  wifi    : 'wifi',
  unknown : 'unk'
}

export const WEB_SOCKET_URL = {
  PUBLIC: 'socket.io',
  PRIVATE: 'engine.io'
}

let lastReqId   : number = 0
let lastEventId : number = 0

export const WIRE_TYPE = {
  REQUEST     : 'REQUEST',
  EVENT       : 'EVENT',
  EVENT_RESP  : 'EVENT_RESP',
  REQ_RESP    : 'REQ_RESP',
  SYS_EVENT   : 'SYS_EVENT'
}

export class WireObject {

  static getWireObject(json: any) {
    switch (json.type) {
      
      case WIRE_TYPE.EVENT:
      return new WireEvent(json.name, json.data, json.ts)

      case WIRE_TYPE.EVENT_RESP:
      return new WireEventResp(json.name, json.ts, json.data, json.error)

      case WIRE_TYPE.REQ_RESP:
      return new WireReqResp(json.name, json.ts, json.data, json.error)

      case WIRE_TYPE.REQUEST:
      return new WireRequest(json.name, json.data, json.ts)

      case WIRE_TYPE.SYS_EVENT:
      return new WireSysEvent(json.name, json.data)

      default:
      console.log('Error: Invalid wire object ' + JSON.stringify(json))
      return null
    }
  }

  type      : string
  name      : string
  ts        : number
  data      : object

  constructor(type: string, name: string, data: object, ts ?: any) {
    this.type = type
    this.name = name
    this.data = data
    this.ts   = ts || Date.now()
  }

  stringify(): string {
    return JSON.stringify(this, (key, value) => key.startsWith('_') ? undefined : value)
  }

  toString() {

    const err = (this as any).error

    return this.type + ':' + this.name + '@' + this.ts + ' ' + 
           (err || JSON.stringify(this.data).substr(0, 50))
  }
}

export class WireRequest extends WireObject {

  _isSent    : boolean = false
  constructor(apiName: string, data: object, ts ?: number, 
              public resolve ?:any, public reject ?:any) {
    super(WIRE_TYPE.REQUEST, apiName, data, ts)
    if (!ts) {
      if (this.ts === lastReqId) this.ts++
      lastReqId = this.ts
    }
  }
}

export class WireEvent extends WireObject {

  constructor(eventName: string, data: object, ts ?: number) {
    super(WIRE_TYPE.EVENT, eventName, data, ts)
    if (!ts) {
      if (this.ts === lastEventId) this.ts++
      lastEventId = this.ts
    }
  }
}

export class WireReqResp extends WireObject {
  error: string | null
  constructor(name: string, ts: number, data: object, error ?: string) {
    super(WIRE_TYPE.REQ_RESP, name, data, ts)
    this.error = error || null
  }
}

export class WireEventResp extends WireObject {
  error: string  | null
  constructor(name: string, ts: number, data ?: object, error ?: string) {
    super(WIRE_TYPE.EVENT_RESP, name, data || {}, ts)
    this.error = error || null
  }
}

export const SYS_EVENT = {
  UPGRADE_CLIENT_IDENTITY : 'UPGRADE_CLIENT_IDENTITY',
  ENC_KEY                 : 'ENC_KEY',
  WS_PROVIDER_CONFIG      : 'WS_PROVIDER_CONFIG',
  PING                    : 'PING'
}

export class WireSysEvent extends WireObject {

  constructor(eventName: string, data: object) {
    super(WIRE_TYPE.SYS_EVENT, eventName, data)
  }
}

export interface WebSocketConfig {
  msPingInterval: number
}

export interface InvocationData {
  name    : string
  ts      : number
  params  : object
  perm    : number
}