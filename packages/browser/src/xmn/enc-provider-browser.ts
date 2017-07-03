/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jun 26 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
  ConnectionInfo,
  WireObject
} from '@mubble/core'

import {  RunContextBrowser} from '../rc-browser'

export class EncryptionBrowser {

  constructor(rc: RunContextBrowser, private ci: ConnectionInfo) {
  }

  // Should return binary buffer
  encodeHeader(rc: RunContextBrowser): any {
    // TODO Field by field by type. Also enc key ????
    // also add network type and location
    const obj = {
      networkType : this.ci.networkType,
      location    : this.ci.location,
      now         : Date.now()
    }
    Object.assign(obj, this.ci.clientIdentity)
    return JSON.stringify(obj)
  }

  // Should return binary buffer
  encodeBody(rc: RunContextBrowser, data: WireObject): any {
   return data.stringify()
   }

  decodeBody(rc: RunContextBrowser, data: string): [WireObject] {

    const inJson = JSON.parse(data),
          arData = Array.isArray(inJson) ? inJson : [inJson]
  
    for (let index = 0; index < arData.length; index++) {
      arData[index] = WireObject.getWireObject(arData[index])
    }

    return arData as [WireObject]
  }

}

