/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 29 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  RunContextServer } from '../rc-server'
import {  ConnectionInfo,
          WireObject
        } from '@mubble/core'

export class EncProviderServer {

  constructor(rc: RunContextServer, private ci: ConnectionInfo) {
  }

  encodeHeader(rc: RunContextServer): any {
    rc.isError() && rc.error(rc.getName(this), 'encodeHeader not implemented')
  }

  // Should return binary buffer
  encodeBody(rc: RunContextServer, data: WireObject): any {
    return data.stringify()
  }

  decodeHeader(rc: RunContextServer, data: any): void {

    console.log(data)
    const headers = JSON.parse(data)

    this.ci.networkType     = headers.networkType
    this.ci.location        = headers.location

    const diff              = Date.now() - headers.now
    this.ci.msOffset        = Math.abs(diff) > 5000 ? diff : 0
    
    delete headers.networkType
    delete headers.location
    delete headers.now

    this.ci.clientIdentity  = headers
  }

  decodeBody(rc: RunContextServer, data: string): [WireObject] {

    const inJson = JSON.parse(data),
          arData = Array.isArray(inJson) ? inJson : [inJson]
  
    for (let index = 0; index < arData.length; index++) {
      arData[index] = WireObject.getWireObject(arData[index])
    }

    return arData as [WireObject]
  }

  sendConfig(rc: RunContextServer) {
    // send enc key
  }

}