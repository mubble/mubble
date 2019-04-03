/*------------------------------------------------------------------------------
   About      : Obopay Wss Client
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble,
         HTTP,
         WssProviderConfig
       }                        from '@mubble/core'
import { RunContextServer }     from '../rc-server'
import { WssEncProvider }       from './wss-enc-provider'
import { CredentialRegistry }   from './credential-registry'
import * as lo                  from 'lodash'

const MICRO_MULT = 1000000

export namespace ObopayWssClient {

  const CLASS_NAME = 'ObopayWssClient'

  export type DefaultWssConfig = {
    pingSecs      : number
    maxOpenSecs   : number
    toleranceSecs : number
  }

  let selfId        : string,
      defaultConfig : DefaultWssConfig,
      maxOpenTs     : number,
      appId         : string,
      credRegistry  : CredentialRegistry,
      privateKey    : string

  export function init(rc             : RunContextServer,
                       selfIdentifier : string,
                       wssConfig      : DefaultWssConfig,
                       appClientId    : string,
                       registry       : CredentialRegistry,
                       pk             : string) {

    if(selfId) throw new Error('Calling init twice.')

    selfId        = selfIdentifier
    defaultConfig = wssConfig
    appId         = appClientId
    credRegistry  = registry
    privateKey    = pk

    Object.freeze(defaultConfig)  // Default wss config cannot change
  }

  export function obopayApi() {
    
  }

  export function establishHandshake() {
    
  }

  export function getWssConfig(incomingConfig : WssProviderConfig,
                               encProvider    : WssEncProvider) : WssProviderConfig {

    // TODO : Logic for pingSecs, maxOpenSecs and toleranceSecs

    const wssConfig = {} as WssProviderConfig

    wssConfig.pingSecs      = incomingConfig.pingSecs < defaultConfig.pingSecs
                              ? incomingConfig.pingSecs
                              : defaultConfig.pingSecs
    wssConfig.maxOpenSecs   = incomingConfig.maxOpenSecs < defaultConfig.pingSecs
                              ? incomingConfig.maxOpenSecs
                              : defaultConfig.maxOpenSecs
    wssConfig.toleranceSecs = incomingConfig.toleranceSecs
    wssConfig.key           = encProvider.getRespAesKey()
    wssConfig.custom        = incomingConfig.custom

    return wssConfig
  }

  export function getEncProvider() : WssEncProvider {
    return new WssEncProvider(privateKey)
  }

  export function verifyClientRequest(rc : RunContextServer, version : string, clientId : string) : boolean {

    rc.isDebug() && rc.debug(CLASS_NAME,
                             'Verifying client request.',
                             `version : ${version}, clientId : ${clientId}`)

    if(!verifyVersion(version)) throw new Error(`Unknown version ${version}.`)

    if(!verifyClientId(clientId)) throw new Error(`Unknown clientId ${clientId}.`)

    return isAppClient(clientId)
  }

  export function verifyVersion(version : string) : boolean {
    return version === HTTP.CurrentProtocolVersion
  }

  export function verifyClientId(clientId : string) : boolean {
    if(appId === clientId) return true
    
    const record = credRegistry.getCredential(clientId)
    return !!record
  }

  export function isAppClient(clientId : string) : boolean {
    return appId === clientId
  }

  export function getClientPublicKey(clientId : string) : string {
    const record = credRegistry.getCredential(clientId)

    if(!record || !record.syncHash)
      throw new Error(`Client ${clientId} doesn't have a public key in registry.`)

    return record.syncHash
  }

  export function verifyRequestTs(requestTs     : number,
                                  lastRequestTs : number,
                                  wssConfig     : WssProviderConfig) : boolean {

    const toleranceMicroS = wssConfig.toleranceSecs * MICRO_MULT,
          pingThreshold   = lastRequestTs + (wssConfig.pingSecs * MICRO_MULT) + toleranceMicroS,
          openThreshold   = maxOpenTs - toleranceMicroS

    return (requestTs < pingThreshold && requestTs < openThreshold)
  }

}