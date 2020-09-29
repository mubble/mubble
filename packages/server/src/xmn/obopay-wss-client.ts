/*------------------------------------------------------------------------------
   About      : Obopay Wss Client
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         HTTP,
         WssProviderConfig,
         Mubble
       }                        from '@mubble/core'
import {
         CredentialRegistry,
         AppRegistry
       }                        from './credential-registry'
import { RunContextServer }     from '../rc-server'
import { WssEncProvider }       from './wss-enc-provider'
import { WssClient }            from './wss-client'

export const HANDSHAKE = '__handshake__'

export namespace ObopayWssClient {

  const CLASS_NAME = 'ObopayWssClient'

  export type DefaultWssConfig = {
    pingSecs      : number
    maxOpenSecs   : number
    toleranceSecs : number
  }

  let selfId               : string,
      defaultConfig        : DefaultWssConfig,
      serverRegistry       : CredentialRegistry,
      appRegistry          : AppRegistry,
      privateKey           : string,
      wssClient            : WssClient

  export function init(rc             : RunContextServer,
                       selfIdentifier : string,
                       wssConfig      : DefaultWssConfig,
                       aRegistry      : AppRegistry,
                       sRegistry      : CredentialRegistry,
                       pk             : string) {

    rc.isDebug() && rc.debug(CLASS_NAME, 'Initializing ObopayWssClient.')

    if(selfId) throw new Error('Calling init twice.')

    selfId               = selfIdentifier
    defaultConfig        = wssConfig
    appRegistry          = aRegistry
    serverRegistry       = sRegistry
    privateKey           = pk

    Object.freeze(defaultConfig)  // Default wss config cannot change
  }

  export async function obopayApi(rc         : RunContextServer,
                                  serverId   : string,
                                  apiName    : string,
                                  params     : Mubble.uObject<any>,
                                  custom    ?: Mubble.uObject<any>,
                                  unsecured ?: boolean) {
    
    rc.isStatus() && rc.status(CLASS_NAME, 'obopayApi', serverId, apiName, params)

    if (!selfId && !defaultConfig && !serverRegistry && !privateKey) {
      throw new Error('ObopayWssClient not initialized.')
    }

    custom = custom || {}

    if (!wssClient) {
      const wsConfig      = {
                              maxOpenSecs   : defaultConfig.maxOpenSecs,
                              pingSecs      : defaultConfig.pingSecs,
                              toleranceSecs : defaultConfig.toleranceSecs,
                              custom        : custom
                            } as WssProviderConfig,
            requestServer = serverRegistry.getCredential(serverId)

      if(!requestServer || !requestServer.syncHash || !requestServer.host || !requestServer.port)
        throw new Error('requestServer not defined.')
  
      wssClient = new WssClient(rc, requestServer, wsConfig, selfId, unsecured)
    }

    return await wssClient.sendRequest(rc, apiName, params)
  }

  export function closeConnection(rc : RunContextServer) {
    rc.isStatus() && rc.status(CLASS_NAME, 'closeConnection')

    wssClient.closeConnection(rc)
    wssClient = null as any
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
    if(!privateKey) throw new Error('ObopayWssClient not initialized.')

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
    return (isAppClient(clientId) || isServerClient(clientId))
  }

  export function isAppClient(clientId : string) : boolean {
    const record = appRegistry.getCredential(clientId)

    return !!(record && record.appShortName)
  }

  export function isServerClient(clientId : string) : boolean {
    const record = serverRegistry.getCredential(clientId)

    return !!(record && record.id)
  }

  export function getClientPublicKey(clientId : string) : string {
    const record = serverRegistry.getCredential(clientId)

    if(!record || !record.syncHash)
      throw new Error(`Client ${clientId} doesn't have a public key in registry.`)

    return record.syncHash
  }

  // export function verifyRequestTs(requestTs     : number,
  //                                 lastRequestTs : number,
  //                                 wssConfig     : WssProviderConfig) : boolean {

  //   const toleranceMicroS = wssConfig.toleranceSecs * MICRO_MULT,
  //         pingThreshold   = lastRequestTs + (wssConfig.pingSecs * MICRO_MULT) + toleranceMicroS,
  //         openThreshold   = maxOpenTs - toleranceMicroS

  //   return (requestTs < pingThreshold && requestTs < openThreshold)
  // }

}