/*------------------------------------------------------------------------------
   About      : Obopay Https Client
   
   Created on : Tue Dec 18 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Mubble,
         WireObject,
         WIRE_TYPE,
         HTTP
       }                        from '@mubble/core'
import { RunContextServer }     from '../rc-server'
import { HttpsEncProvider }     from './https-enc-provider'
import { SecurityErrorCodes }   from './security-errors'
import { UStream }              from '../util'
import { RedisWrapper }         from '../cache'
import * as https               from 'https'
import * as http                from 'http'
import * as fs                  from 'fs'

const REQUEST_TS_RANGE    = 15 * 60 * 1000 * 1000,    // 15 minutes in micro seconds
      REQUEST_EXPIRY_SECS = 30 * 60,                  // 30 minutes in seconds,
      PIPE_SEP            = ' | '

export namespace ObopayHttpsClient {

  const CLASS_NAME = 'ObopayHttpsClient',
        POST       = 'POST'

  let selfId             : string,
      credentialRegistry : CredentialRegistry,
      privateKey         : string,
      requestMem         : RedisWrapper

  export type SyncCredentials = {
    id       : string     // Some identification of the client
    syncHash : string     // Client public key
    ip       : string     // Request IP
  }

  export interface CredentialRegistry {
    getCredential(id : string) : SyncCredentials
  }

  export class ResultStruct {
    error   : null | Error        = null
    headers : Mubble.uObject<any>
    status  : number
    output  : {
      error : null   | string
      data  : number | Mubble.uObject<any>
    }
  }

  export function init(rc           : RunContextServer,
                       selfIdentity : string,
                       registry     : CredentialRegistry,
                       pk           : string,
                       requestRedis : RedisWrapper) {

    rc.isAssert() && rc.assert(CLASS_NAME, !selfId, 'Calling init twice!!!')

    selfId             = selfIdentity
    credentialRegistry = registry
    privateKey         = pk
    requestMem         = requestRedis
  }

  export async function obopayApi(rc            : RunContextServer, 
                                  apiName       : string,
                                  params        : Mubble.uObject<any>,
                                  id            : string,
                                  host          : string,
                                  port          : number = 443,
                                  syncHashPath ?: string) : Promise<ResultStruct> {

    rc.isAssert() && rc.assert(CLASS_NAME, selfId && credentialRegistry, 'selfId and credentialRegistry not defined.')

    const syncHash = syncHashPath ? fs.readFileSync(syncHashPath).toString()
                                  : credentialRegistry.getCredential(id).syncHash,
          json     = {
                      type : WIRE_TYPE.REQUEST,
                      name : apiName,
                      data : params
                     },
          wo       = WireObject.getWireObject(json) as WireObject
    
    const headers : Mubble.uObject<any> = {} 

    headers[HTTP.HeaderKey.clientId]      = selfId
    headers[HTTP.HeaderKey.versionNumber] = HTTP.CurrentProtocolVersion

    const encProvider = new HttpsEncProvider(privateKey, headers)
    
    headers[HTTP.HeaderKey.symmKey] = encProvider.encodeSymmKey(syncHash)
    
    const options : https.RequestOptions = {
      host     : host,
      port     : port,
      method   : POST,
      protocol : HTTP.Const.protocolHttps,
      headers  : headers
    }

    return await request(rc, options, encProvider, wo)
  }

  export async function request(rc          : RunContextServer,
                                options     : https.RequestOptions,
                                encProvider : HttpsEncProvider,
                                wo          : WireObject) : Promise<ResultStruct> {

    const req          = https.request(options),
          writePromise = new Mubble.uPromise(),
          readPromise  = new Mubble.uPromise(),
          result       = new ResultStruct()

    req.on('reaponse', (resp : http.IncomingMessage) => {
      result.headers = resp.headers
      result.status  = resp.statusCode || 200

      const readStreams = [resp]

      rc.isStatus() && rc.status(CLASS_NAME, 'https request response.',
                                 resp, resp.headers)

      const readUstream = new UStream.ReadStreams(rc, readStreams, readPromise)
      readUstream.read()
    })

    req.on('error', (err : Error) => {
      rc.isError() && rc.error(CLASS_NAME, 'https request error.', err)

      writePromise.reject(err)
      readPromise.reject(err)
    })

    const encWo        = encProvider.encodeWireObject(wo, [req]),
          writeStreams = encWo.streams,
          data         = encWo.data,
          writeUstream = new UStream.WriteStreams(rc, writeStreams, writePromise)

    writeUstream.write(data)

    rc.isStatus() && rc.status(CLASS_NAME, 'https request to server.',
                               options, options.headers)

    try {
      const [ , output] : Array<any> = await Promise.all([writePromise.promise,
                                                          readPromise.promise])

      result.output = output
    } catch(err) {
      rc.isError() && rc.error(CLASS_NAME, err)
      result.error = err
    }

    return result
  }

  export function verifyClientRequest(rc       : RunContextServer,
                                      headers  : Mubble.uObject<any>,
                                      clientIp : string) : HttpsEncProvider {

    rc.isStatus() && rc.status(CLASS_NAME,
                               'Verifying client request headers.',
                               headers,
                               clientIp)

    const clientCredentials = credentialRegistry.getCredential(headers[HTTP.HeaderKey.clientId])

    if(clientCredentials
       && clientCredentials.syncHash
       && clientCredentials.ip
       && clientCredentials.ip === clientIp) {

      if(!verifyVersion(headers[HTTP.HeaderKey.versionNumber]))
        throw new Mubble.uError(SecurityErrorCodes.INVALID_VERSION,
                                `Request version : ${headers[HTTP.HeaderKey.versionNumber]},`
                                + `Current version : ${HTTP.CurrentProtocolVersion}.`) 

      if(!headers[HTTP.HeaderKey.bodyEncoding])
        headers[HTTP.HeaderKey.bodyEncoding] = HTTP.HeaderValue.identity

      const encProvider = new HttpsEncProvider(privateKey, headers),
            requestTs   = encProvider.getRequestTs(clientCredentials.syncHash)

      if(!verifyRequestTs(requestTs))
        throw new Mubble.uError(SecurityErrorCodes.INVALID_REQUEST_TS,
                                'requestTs out of range.')

      return encProvider
    }

    throw new Mubble.uError(SecurityErrorCodes.INVALID_CLIENT,
                            'Client not found in registry.')
  }

  export function verifyVersion(version : string) : boolean {
    return version === HTTP.CurrentProtocolVersion
  }

  export function verifyRequestTs(requestTs : number) : boolean {
    const serverTsMicro = Date.now() * 1000

    return (serverTsMicro + REQUEST_TS_RANGE) > requestTs 
           && (serverTsMicro - REQUEST_TS_RANGE) < requestTs
  }

  export async function addRequestToMemory(xObopayTs   : string,
                                           xObopayCid  : string,
                                           apiName     : string,
                                           messageBody : string) {

    const key    = xObopayTs  + PIPE_SEP +
                   xObopayCid + PIPE_SEP +
                   apiName    + PIPE_SEP +
                   messageBody,
          replay = await verifyRequestReplay(key)

    if(replay)
      throw new Mubble.uError(SecurityErrorCodes.REQUEST_REPLAY, 'Replay attack ???')

    const multi = requestMem.redisMulti()

    multi.set(key, Date.now())
    multi.expire(key, REQUEST_EXPIRY_SECS)

    await requestMem.execRedisMulti(multi)
  }

  // Verifies request-replay, returns true for replay attacks.
  export async function verifyRequestReplay(requestKey : string) : Promise<boolean> {
    const exists = await requestMem.redisCommand().exists(requestKey)

    return exists
  }


}
