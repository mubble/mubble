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
import { CredentialRegistry, SyncCredentials }   from './credential-registry'
import * as https               from 'https'
import * as http                from 'http'
import * as fs                  from 'fs'
import * as stream              from 'stream'
import * as lo                  from 'lodash'
import * as urlModule           from 'url'

const REQUEST_TS_RANGE    = 15 * 60 * 1000 * 1000,    // 15 minutes in micro seconds
      REQUEST_EXPIRY_SECS = 30 * 60,                  // 30 minutes in seconds
      PIPE_SEP            = ' | ',
      SLASH_SEP           = '/'

export namespace ObopayHttpsClient {

  const CLASS_NAME = 'ObopayHttpsClient',
        POST       = 'POST'

  let selfId             : string,
      credentialRegistry : CredentialRegistry,
      privateKey         : string,
      requestMem         : RedisWrapper

  export class ResultStruct {
    error   : null | Error        = null
    headers : Mubble.uObject<any>
    status  : number
    output  : Mubble.uObject<any>
    // output  : {
    //   error : null   | string
    //   data  : number | Mubble.uObject<any>
    // }
  }

  export function init(rc           : RunContextServer,
                       selfIdentity : string,
                       registry     : CredentialRegistry,
                       pk           : string,
                       requestRedis : RedisWrapper) {

    if(selfId) throw new Error('Calling init twice.')

    selfId             = selfIdentity
    credentialRegistry = registry
    privateKey         = pk
    requestMem         = requestRedis
  }

  export async function obopayApi(rc            : RunContextServer, 
                                  apiName       : string,
                                  params        : Mubble.uObject<any>,
                                  serverId      : string,
                                  unsecured    ?: boolean,
                                  syncHashPath ?: string) : Promise<ResultStruct> {

    if(!selfId || !credentialRegistry)
      throw new Error('ObopayHttpsClient not initialized.')

    const requestServer = credentialRegistry.getCredential(serverId)

    if(!requestServer || !requestServer.host || !requestServer.port)
      throw new Error('requestServer not defined.')

    const syncHash   = syncHashPath ? fs.readFileSync(syncHashPath).toString()
                                    : requestServer.syncHash,
          json       = {
                         type : WIRE_TYPE.REQUEST,
                         name : apiName,
                         data : params
                       },
          wo         = WireObject.getWireObject(json) as WireObject
    
    const headers : Mubble.uObject<any> = {}

    headers[HTTP.HeaderKey.clientId]      = selfId
    headers[HTTP.HeaderKey.versionNumber] = HTTP.CurrentProtocolVersion
    headers[HTTP.HeaderKey.contentType]   = HTTP.HeaderValue.stream

    const encProvider = new HttpsEncProvider(privateKey)
    
    headers[HTTP.HeaderKey.symmKey]   = encProvider.encodeRequestKey(syncHash)
    headers[HTTP.HeaderKey.requestTs] = encProvider.encodeRequestTs(wo.ts)

    const encBodyObj = encProvider.encodeBody(wo.data, false)

    headers[HTTP.HeaderKey.bodyEncoding] = encBodyObj.bodyEncoding
    encBodyObj.contentLength ? headers[HTTP.HeaderKey.contentLength]    = encBodyObj.contentLength
                             : headers[HTTP.HeaderKey.transferEncoding] = HTTP.HeaderValue.chunked
    
    rc.isDebug() && rc.debug(CLASS_NAME,
                             `http${unsecured ? '' : 's'} request headers.`,
                             headers)

    const options : https.RequestOptions = {
      method   : POST,
      protocol : unsecured ? HTTP.Const.protocolHttp : HTTP.Const.protocolHttps,
      host     : requestServer.host,
      port     : requestServer.port,
      path     : SLASH_SEP + wo.name,
      headers  : headers
    }

    return await request(rc,
                         options,
                         syncHash,
                         encProvider,
                         encBodyObj.streams,
                         encBodyObj.dataStr,
                         unsecured)
  }

  export async function request(rc            : RunContextServer,
                                options       : https.RequestOptions,
                                serverPubKey  : string,
                                encProvider   : HttpsEncProvider,
                                writeStreams  : Array<stream.Writable>,
                                dataStr       : string,
                                unsecured    ?: boolean) : Promise<ResultStruct> {

    const req          = unsecured ? http.request(options) : https.request(options),
          writePromise = new Mubble.uPromise(),
          readPromise  = new Mubble.uPromise(),
          result       = new ResultStruct()

    writeStreams.push(req)

    req.on('response', (resp : http.IncomingMessage) => {
      result.headers = resp.headers
      result.status  = resp.statusCode || 200

      rc.isDebug() && rc.debug(CLASS_NAME,
                               `http${unsecured ? '' : 's'} response headers.`,
                               resp.headers)

      if(!result.headers[HTTP.HeaderKey.symmKey])
        throw new Error(`${HTTP.HeaderKey.symmKey} missing in response headers.`)

      if(!result.headers[HTTP.HeaderKey.bodyEncoding])
        result.headers[HTTP.HeaderKey.bodyEncoding] = HTTP.HeaderValue.identity

      encProvider.decodeResponseKey(serverPubKey, result.headers[HTTP.HeaderKey.symmKey])

      const readStreams = encProvider.decodeBody([resp],
                                                 result.headers[HTTP.HeaderKey.bodyEncoding],
                                                 true)

      const readUstream = new UStream.ReadStreams(rc, readStreams, readPromise)
      readUstream.read()
    })

    req.on('error', (err : Error) => {
      rc.isError() && rc.error(CLASS_NAME,
                               `http${unsecured ? '' : 's'} request error.`,
                               err)

      writePromise.reject(err)
      readPromise.reject(err)
    })

    const writeUstream = new UStream.WriteStreams(rc, writeStreams, writePromise)

    writeUstream.write(dataStr)

    rc.isStatus() && rc.status(CLASS_NAME,
                               `http${unsecured ? '' : 's'} request.`,
                               options)

    try {
      const [ , output] : Array<any> = await Promise.all([writePromise.promise,
                                                          readPromise.promise])

      rc.isStatus() && rc.status(CLASS_NAME,
                                 `http${unsecured ? '' : 's'} response.`,
                                 output.toString())

      result.output = JSON.parse(output.toString())
    } catch(err) {
      rc.isError() && rc.error(CLASS_NAME, err)
      result.error = err
    }

    return result
  }

  export function getEncProvider() : HttpsEncProvider {
    return new HttpsEncProvider(privateKey)
  }

  export function verifyClientRequest(rc          : RunContextServer,
                                      encProvider : HttpsEncProvider,
                                      headers     : Mubble.uObject<any>,
                                      clientIp    : string) {

    rc.isDebug() && rc.debug(CLASS_NAME,
                             'Verifying client request headers.',
                             headers,
                             clientIp)

    const clientCredentials = credentialRegistry.getCredential(headers[HTTP.HeaderKey.clientId])

    if(clientCredentials
       && clientCredentials.syncHash
       && clientCredentials.permittedIps.length) {
        
      if(!verifyIp(clientCredentials.permittedIps, clientIp)) {
        throw new Mubble.uError(SecurityErrorCodes.INVALID_CLIENT,
                                'Client IP not permitted.')
      }

      if(!verifyVersion(headers[HTTP.HeaderKey.versionNumber])) {
        throw new Mubble.uError(SecurityErrorCodes.INVALID_VERSION,
                                `Request version : ${headers[HTTP.HeaderKey.versionNumber]},`
                                + `Current version : ${HTTP.CurrentProtocolVersion}.`) 
      }

      if(!headers[HTTP.HeaderKey.bodyEncoding])
        headers[HTTP.HeaderKey.bodyEncoding] = HTTP.HeaderValue.identity

      const requestTs = encProvider.decodeRequestTs(clientCredentials.syncHash,
                                                    headers[HTTP.HeaderKey.requestTs])

      encProvider.decodeRequestKey(headers[HTTP.HeaderKey.symmKey])

      if(!verifyRequestTs(requestTs)) {
        throw new Mubble.uError(SecurityErrorCodes.INVALID_REQUEST_TS,
                                'requestTs out of range.')
      }

      return true
    }

    throw new Mubble.uError(SecurityErrorCodes.INVALID_CLIENT,
                            'Client not found in registry.')
  }

  export function verifyIp(permittedIps : Array<string>, ip : string) : boolean {
    return lo.includes(permittedIps, ip)
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

  export function getThirdPartyRequestUrl(rc          : RunContextServer,
                                          credentials : SyncCredentials,
                                          apiName     : string,
                                          apiParams   : Mubble.uObject<any>) : string {

    const encProvider    = getEncProvider(),
          requestPath    = encProvider.encodeThirdPartyRequestPath(credentials.syncHash, apiParams),
          encRequestPath = encodeURIComponent(requestPath),
          urlObj         = {
                             protocol : HTTP.Const.protocolHttps,
                             host     : credentials.host,
                             port     : credentials.port,
                             path     : apiName + SLASH_SEP + encRequestPath
                           },
          url            = urlModule.format(urlObj)

    rc.isStatus() && rc.status(CLASS_NAME, 'getThirdPartyRequestUrl', url)
                
    return url
  }
}
