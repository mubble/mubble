/*------------------------------------------------------------------------------
   About      : Obopay Wss Client
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble,
         HTTP
       }                      from '@mubble/core'
import { RunContextServer }   from '../rc-server'
import { WssEncProvider }     from './wss-enc-provider'

export namespace ObopayWssClient {

  export type WssProviderConfig = {
    pingSecs      : number
    maxOpenSecs   : number
    toleranceSecs : number
    custom        : Mubble.uObject<any>
  }

  let pingMs      : number,
      maxOpenTs   : number,
      toleranceMs : number

  export function init(wsConfig : WssProviderConfig) {
    
  }

  export function obopayApi() {
    
  }

  export function establishHandshake() {
    
  }

  export function verifyVersion(version : string) : boolean {
    return version === HTTP.CurrentProtocolVersion
  }

  export function verifyRequestTs(requestTs     : number,
                                  lastRequestTs : number) : boolean {

    const pingTs = lastRequestTs + pingMs + toleranceMs,
          openTs = maxOpenTs - toleranceMs

    return (requestTs < pingTs && requestTs < openTs)
  }




}