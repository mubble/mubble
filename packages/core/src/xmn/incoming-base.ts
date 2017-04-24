/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export enum Protocol {HTTP, WEBSOCKET, HTTPS}

// TODO: We are not using protection from external write and stuff like Object.seal
export abstract class ConnectionAttrBase {

  ip          : string
  protocol    : Protocol
  host        : string
  port        : number
  url         : string // /api/getTopics

  abstract copyConstruct(): any // should return object of type ConnectionAttrBase

  clone(newCab: ConnectionAttrBase) {
    // all attrs are unique, we cannot copy anything to new connection
  }
}

export abstract class IncomingRequestBase {

  api         : string
  param       : object
  startTs     : number

  connectAttr : ConnectionAttrBase

  abstract copyConstruct(): any // should return object of type IncomingRequestBase

  clone(newIrb: IncomingRequestBase) {
    // all attrs are unique, we cannot copy anything to new connection
  }

  setApi(api: string) {
    this.api = api
  }

  setParam(param: object) {
    this.param = param
  }
}

export abstract class IncomingEventBase {

  name        : string
  param       : object
  startTs     : number

  connectAttr : ConnectionAttrBase

  abstract copyConstruct(): any // should return object of type IncomingEventBase

  clone(newIeb: IncomingEventBase) {
    // all attrs are unique, we cannot copy anything to new connection
  }
  setName(name: string) {
    this.name = name
  }

  setParam(param: object) {
    this.param = param
  }
}

