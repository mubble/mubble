/*------------------------------------------------------------------------------
   About      : Obopay Https Client
   
   Created on : Tue Dec 18 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Mubble,
         HTTP
       }                        from '@mubble/core'
import {
         CredentialRegistry,
         ServerCredentials
       }                        from './credential-registry'
import { RunContextServer }     from '../rc-server'
import { HttpsEncProvider }     from './https-enc-provider'
import { SecurityErrorCodes }   from './security-errors'
import { UStream }              from '../util'
import { RedisWrapper }         from '../cache'
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

  export type ResultStruct = {
    // error   : null | Error        = null
    // headers : Mubble.uObject<any>
    // status  : number
    // output  : Mubble.uObject<any>
    
    error : null   | string
    data  : number | string | Mubble.uObject<any>
  }

  export function init(rc           : RunContextServer,
                       selfIdentity : string,
                       registry     : CredentialRegistry,
                       pk           : string,
                       requestRedis : RedisWrapper) {

    rc.isDebug() && rc.debug(CLASS_NAME, 'Initializing ObopayHttpsClient.')
                    
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

    if(!requestServer || !requestServer.syncHash || !requestServer.host || !requestServer.port)
      throw new Error('requestServer not defined.')

    const syncHash                      = syncHashPath ? fs.readFileSync(syncHashPath).toString()
                                                       : requestServer.syncHash,
          requestTs                     = Date.now() * 1000,
          headers : Mubble.uObject<any> = {}

    rc.isDebug() && rc.debug(CLASS_NAME, 'requestTs', requestTs)


    const encProvider = new HttpsEncProvider(privateKey)

    headers[HTTP.HeaderKey.clientId]      = selfId
    headers[HTTP.HeaderKey.versionNumber] = HTTP.CurrentProtocolVersion
    headers[HTTP.HeaderKey.contentType]   = HTTP.HeaderValue.stream
    headers[HTTP.HeaderKey.symmKey]       = encProvider.encodeRequestKey(syncHash)
    headers[HTTP.HeaderKey.requestTs]     = encProvider.encodeRequestTs(requestTs)

    const encBodyObj = encProvider.encodeBody(params, false)

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
      path     : `/${apiName}`,
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
          readPromise  = new Mubble.uPromise()

    writeStreams.push(req)

    req.on('response', (resp : http.IncomingMessage) => {

      rc.isDebug() && rc.debug(CLASS_NAME,
                               `http${unsecured ? '' : 's'} response headers.`,
                               resp.headers)

      if(!resp.headers[HTTP.HeaderKey.symmKey]) {
        const err = new Error(`${HTTP.HeaderKey.symmKey} missing in response headers.`)
        writePromise.reject(err)
        readPromise.reject(err)
        // throw err
      }

      if(!resp.headers[HTTP.HeaderKey.bodyEncoding])
        resp.headers[HTTP.HeaderKey.bodyEncoding] = HTTP.HeaderValue.identity

      encProvider.decodeResponseKey(serverPubKey, resp.headers[HTTP.HeaderKey.symmKey] as string)

      const readStreams = encProvider.decodeBody([resp],
                                                 resp.headers[HTTP.HeaderKey.bodyEncoding] as string,
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

    const [ , output] : Array<any> = await Promise.all([writePromise.promise,
                                                        readPromise.promise])

    rc.isStatus() && rc.status(CLASS_NAME,
                                `http${unsecured ? '' : 's'} response.`,
                                output.toString())

    const result = JSON.parse(output.toString())
    return result
  }

  export function getEncProvider() : HttpsEncProvider {
    return new HttpsEncProvider(privateKey)
  }

  export function verifyClientRequest(rc          : RunContextServer,
                                      clientId    : string,
                                      encProvider : HttpsEncProvider,
                                      headers     : Mubble.uObject<any>,
                                      clientIp    : string) {

    rc.isDebug() && rc.debug(CLASS_NAME,
                             'Verifying client request headers.',
                             headers,
                             clientIp)

    if(!headers[HTTP.HeaderKey.symmKey]) {
      throw new Error(`${HTTP.HeaderKey.symmKey} missing in request headers.`)
    }
                        
    encProvider.decodeRequestKey(headers[HTTP.HeaderKey.symmKey])

    const clientCredentials = credentialRegistry.getCredential(clientId)

    if(clientCredentials
       && clientCredentials.syncHash
       && clientCredentials.permittedIps
       && clientCredentials.permittedIps.length) {
        
      if(!verifyIp(clientCredentials.permittedIps, clientIp)) {
        throw new Mubble.uError(SecurityErrorCodes.INVALID_CLIENT,
                                'Client IP not permitted.')
      }

      if(!headers[HTTP.HeaderKey.bodyEncoding])
        headers[HTTP.HeaderKey.bodyEncoding] = HTTP.HeaderValue.identity

      const requestTs = encProvider.decodeRequestTs(clientCredentials.syncHash,
                                                    headers[HTTP.HeaderKey.requestTs])

      rc.isDebug() && rc.debug(CLASS_NAME, 'requestTs', requestTs)

      if(!verifyRequestTs(requestTs)) {
        throw new Mubble.uError(SecurityErrorCodes.INVALID_REQUEST_TS,
                                'requestTs out of range.')
      }

      return true
    }

    throw new Mubble.uError(SecurityErrorCodes.INVALID_CLIENT,
                            'Client not found in registry.')
  }

  export function verifyClientId(clientId : string) : boolean {
    const clientCredentials = credentialRegistry.getCredential(clientId)

    return !!clientCredentials
  }

  export function verifyIp(permittedIps : Array<string>, ip : string) : boolean {
    permittedIps.forEach((permittedIp) => permittedIps.push('::ffff:' + permittedIp))

    return lo.includes(permittedIps, ip)
  }

  export function verifyVersion(version : string) : boolean {
    return version === HTTP.CurrentProtocolVersion
  }

  export function verifyModule(module : string, apiName : string) : boolean {
    // TODO : Add module and apiName check

    return true
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
                                          credentials : ServerCredentials,
                                          apiName     : string,
                                          apiParams   : Mubble.uObject<any>) : string {

    const encProvider    = getEncProvider(),
          requestPath    = encProvider.encodeThirdPartyRequestPath(credentials.syncHash, apiParams),
          encRequestPath = encodeURIComponent(requestPath),
          urlObj         = {
                             protocol : HTTP.Const.protocolHttps,
                             hostname : credentials.host,
                             port     : credentials.port,
                             pathname : SLASH_SEP + apiName + SLASH_SEP + encRequestPath
                           },
          url            = urlModule.format(urlObj)

    rc.isStatus() && rc.status(CLASS_NAME, 'getThirdPartyRequestUrl', url)
                
    return url
  }
}
