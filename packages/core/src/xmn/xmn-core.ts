/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 29 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble, RunContextBase } from '..'
export enum Protocol {HTTP, WEBSOCKET, HTTPS}

/* HTTP Headers */
export namespace HTTP {

  // normally these keys are written with uppercase, we are writing them in lowercase 
  // for compatibility
  export const HeaderKey = {
    userAgent       : 'user-agent',
    clientSecret    : 'x-client-secret',
    contentType     : 'content-type',
    contentLength   : 'content-length',
    contentEncoding : 'content-encoding'
  }
  
  /* HTTP Headers */
  export const HeaderValue = {
    form    : 'application/x-www-form-urlencoded',
    gzip    : 'gzip',
    deflate : 'deflate'
  }

  export const Const = {
    protocolHttp  : 'http:',
    protocolHttps : 'https:'
  }
}

export const NetworkType = {
  net2G   : '2G',
  net3G   : '3G',
  net4G   : '4G',
  net5G   : '5G',
  wifi    : 'wifi',
  unknown : 'unk',
  absent  : 'absent'
}

export const WEB_SOCKET_URL = {
  ENC_PUBLIC    : 'socket.io',
  ENC_PRIVATE   : 'engine.io',
  PLAIN_PUBLIC  : 'rocket.io',
  PLAIN_PRIVATE : 'locket.io'
}

let lastReqId   : number = 0
let lastEventId : number = 0

export const WIRE_TYPE = {
  REQUEST     : 'REQUEST',
  EVENT       : 'EVENT',
  SYS_EVENT   : 'SYS_EVENT',
  EPH_EVENT   : 'EPH_EVENT',
  EVENT_RESP  : 'EVENT_RESP',
  REQ_RESP    : 'REQ_RESP'
}

export class WireObject {

  static getWireObject(json: any) {
    switch (json.type) {
      
      case WIRE_TYPE.REQUEST:
      return new WireRequest(json.name, json.data, json.ts)

      case WIRE_TYPE.EVENT:
      return new WireEvent(json.name, json.data, json.ts)

      case WIRE_TYPE.EPH_EVENT:
      return new WireEphEvent(json.name, json.data, json.ts)

      case WIRE_TYPE.SYS_EVENT:
      return new WireSysEvent(json.name, json.data)

      case WIRE_TYPE.EVENT_RESP:
      return new WireEventResp(json.name, json.ts, json.data, json.errorCode, json.errorMessage)

      case WIRE_TYPE.REQ_RESP:
      return new WireReqResp(json.name, json.ts, json.data, json.errorCode, json.errorMessage)

      default:
      console.info('Error: Invalid wire object ' + JSON.stringify(json))
      return null
    }
  }

  type      : string
  name      : string
  ts        : number
  data      : Mubble.uObject<any>

  constructor(type: string, name: string, data: object, ts ?: any) {
    this.type = type
    this.name = name
    this.data = data
    this.ts   = ts || Date.now()
  }

  stringify(): string {
    return JSON.stringify(this, (key, value) => 
      key.startsWith('_') || 
      (value && value.constructor.hasOwnProperty('byteLength')) ? undefined : value)
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

export class WireEphEvent extends WireObject {

  constructor(eventName: string, data: object, ts ?: number) {
    super(WIRE_TYPE.EPH_EVENT, eventName, data, ts)
  }
}

export class WireReqResp extends WireObject {
  errorCode    : string | null
  errorMessage : string | null
  _err ?: any   // Full Error Object Instance. need not go to client (_). Required for trace logging
  constructor(name: string, ts: number, data: object, errorCode ?: string, errorMessage ?: string, fullErr ?: any) {
    super(WIRE_TYPE.REQ_RESP, name, data, ts)

    this.errorCode    = errorCode || null
    this.errorMessage = errorMessage || null
    this._err         = fullErr
  }
}

export class WireEventResp extends WireObject {
  errorCode    : string  | null
  errorMessage : string | null
  _err ?: any   // Full Error Object Instance. need not go to client (_). Required for trace logging
  constructor(name: string, ts: number, data ?: object, errorCode ?: string, errorMessage ?: string, fullErr ?: any) {
    super(WIRE_TYPE.EVENT_RESP, name, data || {}, ts)

    this.errorCode    = errorCode || null
    this.errorMessage = errorMessage || null
    this._err         = fullErr
  }
}

export const SYS_EVENT = {
  UPGRADE_CLIENT_IDENTITY : 'UPGRADE_CLIENT_IDENTITY',
  WS_PROVIDER_CONFIG      : 'WS_PROVIDER_CONFIG',
  ERROR                   : 'ERROR',
  PING                    : 'PING'
}

export class WireSysEvent extends WireObject {

  constructor(eventName: string, data: object) {
    super(WIRE_TYPE.SYS_EVENT, eventName, data)
  }
}

export interface WebSocketConfig {
  msPingInterval   : number
  syncKey         ?: string
}

export interface ConnectionError {
  code : string
  msg  : string
}

export interface InvocationData {
  name    : string
  ts      : number
  params  : object
}

export const Leader = {
  BIN         : 'B',
  CONFIG      : 'C',
  DEF_JSON    : 'D',
  JSON        : 'J'
}

export const Encoder = {
  MIN_SIZE_TO_COMPRESS  : 500
}

export interface XmnProvider {
  send(rc: RunContextBase , data: WireObject[]) : void
  requestClose() : void
}

export interface ActiveProviderCollection {
  addActiveProvider(clientId : number, provider : XmnProvider) : void
  getActiveProvider(clientId : number) : XmnProvider | undefined
}