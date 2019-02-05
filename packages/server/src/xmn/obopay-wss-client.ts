/*------------------------------------------------------------------------------
   About      : Obopay Wss Client
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble,
         HTTP
       }                        from '@mubble/core'
import { RunContextServer }     from '../rc-server'
import { WssEncProvider }       from './wss-enc-provider'
import { CredentialRegistry }   from './credential-registry'
import * as lo                  from 'lodash'

export namespace ObopayWssClient {

  const CLASS_NAME = 'ObopayWssClient'

  export type WssProviderConfig = {
    pingSecs      : number
    maxOpenSecs   : number
    toleranceSecs : number
    custom        : Mubble.uObject<any>
  }

  let selfId       : string,
      pingMs       : number,
      maxOpenTs    : number,
      maxOpenSecs  : number,
      toleranceMs  : number,
      appId        : string,
      credRegistry : CredentialRegistry,
      privateKey   : string

  export function init(rc             : RunContextServer,
                       selfIdentifier : string,
                       wsConfig       : WssProviderConfig,
                       appClientId    : string,
                       registry       : CredentialRegistry,
                       pk             : string) {

    rc.isAssert() && rc.assert(CLASS_NAME, !selfId, 'Calling init twice!!!')

    selfId       = selfIdentifier
    pingMs       = wsConfig.pingSecs * 1000
    maxOpenSecs  = wsConfig.maxOpenSecs
    toleranceMs  = wsConfig.toleranceSecs * 1000
    appId        = appClientId
    credRegistry = registry
    privateKey   = pk
  }

  export function obopayApi() {
    
  }

  export function establishHandshake() {
    
  }

  export function getConfigData(openTs : number) : {
                                                     pingMs      : number
                                                     maxOpenSecs : number
                                                     toleranceMs : number
                                                   } {

    maxOpenTs = openTs + (maxOpenSecs * 1000)

    return {pingMs, maxOpenSecs, toleranceMs}
  }

  export function verifyClientRequest(rc : RunContextServer, version : string, clientId : string) : boolean {

    rc.isDebug() && rc.debug(CLASS_NAME,
                             'Verifying client request.',
                             `version : ${version}, clientId : ${clientId}`)

    if(!verifyVersion(version)) throw new Error(`Unknown version ${version}.`)

    if(!verifyClientId(clientId)) throw new Error(`Unknown clientId ${clientId}.`)

    return true
  }

  export function verifyVersion(version : string) : boolean {
    return version === HTTP.CurrentProtocolVersion
  }

  export function isAppClient(clientId : string) : boolean {
    return appId === clientId
  }

  export function verifyClientId(clientId : string) : boolean {
    if(appId === clientId) return true
    
    const record = credRegistry.getCredential(clientId)
    return !!record.id
  }

  export function verifyRequestTs(requestTs     : number,
                                  lastRequestTs : number) : boolean {

    const pingThreshold = lastRequestTs + pingMs + toleranceMs,
          openThreshold = maxOpenTs - toleranceMs

    return (requestTs < pingThreshold && requestTs < openThreshold)
  }




}