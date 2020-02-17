/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 29 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble, RunContextBase } from '..'
import { CustomData }             from './custom-data'

export enum Protocol {HTTP, WEBSOCKET, HTTPS, HTTP_THIRD}

export const HANDSHAKE = '__handshake__'

/* HTTP Headers */
export namespace HTTP {

  // normally these keys are written with uppercase, we are writing them in lowercase 
  // for compatibility
  export const HeaderKey = {
    userAgent        : 'user-agent',
    clientSecret     : 'x-client-secret',
    contentType      : 'content-type',
    contentLength    : 'content-length',
    setCookie        : 'set-cookie',
    contentEncoding  : 'content-encoding',
    clientId         : 'x-obopay-cid',
    versionNumber    : 'x-obopay-version',
    requestTs        : 'x-obopay-ts',
    symmKey          : 'x-obopay-key',
    requestType      : 'x-obopay-type',
    bodyEncoding     : 'x-obopay-encoding',
    transferEncoding : 'transfer-encoding',
    location         : 'location',
    accept           : 'accept',
    authorization    : 'authorization',
    token            : 'token'
  }
  
  /* HTTP Headers */
  export const HeaderValue = {
    form     : 'application/x-www-form-urlencoded',
    mutiForm : 'multipart/form-data',
    stream   : 'application/octet-stream',
    json     : 'application/json',
    gzip     : 'gzip',
    deflate  : 'deflate',
    identity : 'identity',
    version2 : 'v2',
    chunked  : 'chunked'
  }

  export const Const = {
    protocolHttp  : 'http:',
    protocolHttps : 'https:'
  }

  export const Method = {
    PUT    : 'PUT',
    GET    : 'GET',
    POST   : 'POST',
    DELETE : 'DELETE'
  }

  export const CurrentProtocolVersion = HTTP.HeaderValue.version2
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

  static parseString(str : string) : WireObject {
    return JSON.parse(str)
  }

  type      : string
  name      : string
  ts        : number
  data      : Mubble.uObject<any>

  constructor(type: string, name: string, data: object, ts ?: any) {
    this.type = type
    this.name = name
    this.data = data
    this.ts   = ts || Date.now() * 1000
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
  errorObject  : Mubble.uObject<any> | undefined

  _err ?: any   // Full Error Object Instance. need not go to client (_). Required for trace logging
  constructor(name : string, ts : number, data : object, errorCode ?: string, errorMessage ?: string,
              errorObject ?: Mubble.uObject<any>, fullErr ?: any) {

    super(WIRE_TYPE.REQ_RESP, name, data, ts)

    this.errorCode    = errorCode || null
    this.errorMessage = errorMessage || null
    this.errorObject  = errorObject
    this._err         = fullErr
  }
}

export class WireEventResp extends WireObject {
  errorCode    : string | null
  errorMessage : string | null
  errorObject  : Mubble.uObject<any> | undefined

  _err ?: any   // Full Error Object Instance. need not go to client (_). Required for trace logging
  constructor(name : string, ts : number, data ?: object, errorCode ?: string, errorMessage ?: string,
              errorObject ?: Mubble.uObject<any>, fullErr ?: any) {
    
    super(WIRE_TYPE.EVENT_RESP, name, data || {}, ts)

    this.errorCode    = errorCode || null
    this.errorMessage = errorMessage || null
    this.errorObject  = errorObject
    this._err         = fullErr
  }
}

export const SYS_EVENT = {
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

export interface WssProviderConfig {
  pingSecs      : number
  maxOpenSecs   : number
  toleranceSecs : number
  key           : string
  custom        : CustomData
}

export const WssErrorCode = {
  HANDSHAKE_FAILURE : 501,
  INVALID_REQUESTTS : 502
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

export const DataLeader = {
  BINARY       : 0x01,
  DEF_JSON     : 0x02,
  JSON         : 0x03,
  ENC_BINARY   : 0x04,
  ENC_DEF_JSON : 0x05,
  ENC_JSON     : 0x06
}

export const Encoder = {
  MIN_SIZE_TO_COMPRESS  : 500
}

export interface XmnProvider {
  send(rc: RunContextBase , data: WireObject[]) : void
  requestClose(rc : RunContextBase) : void
}

export interface ActiveProviderCollection {
  addActiveProvider(clientId : number, provider : XmnProvider) : void
  getActiveProvider(clientId : number) : XmnProvider | undefined
}