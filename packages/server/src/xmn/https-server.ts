/*------------------------------------------------------------------------------
   About      : New https server
   
   Created on : Mon Dec 31 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         XmnError,
         ConnectionInfo,
         SessionInfo,
         Protocol,
         HTTP,
         XmnProvider,
         Mubble,
         WireObject,
         WireRequest,
         WireReqResp
       }                      from '@mubble/core'
import {
         SecurityError,
         SecurityErrorCodes
       }                      from './security-errors'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer }    from './xmn-router-server'
import { ObopayHttpsClient }  from './obopay-https-client'
import { HttpsEncProvider }   from './https-enc-provider'
import { UStream }            from '../util'
import * as http              from 'http'
import * as urlModule         from 'url'

const TIMER_FREQUENCY_MS = 10 * 1000,  // to detect timed-out requests
      HTTP_TIMEOUT_MS    = 60 * 1000,  // timeout in ms
      POST               = 'POST',
      SUCCESS            = 'success'

export class HttpsServer {

  private providerMap : Map<HttpsServerProvider, number>

  constructor(private refRc : RunContextServer, private router : XmnRouterServer) {
    this.providerMap = new Map()
    
    setInterval(this.cbTimerPing.bind(this), TIMER_FREQUENCY_MS)
  }

  async requestHandler(req : http.IncomingMessage, res : http.ServerResponse) {

    const rc = this.refRc.copyConstruct('', 'https-request')

    const urlObj   = urlModule.parse(req.url || ''),
          pathName = urlObj.pathname || '',
          ar       = (pathName.startsWith('/') ? pathName.substr(1) : pathName).split('/'),
          apiName  = ar[0]

    const ci           = {} as ConnectionInfo,
          si           = {} as SessionInfo,
          [host, port] = (req.headers.host || '').split(':')

    ci.protocol       = urlObj.protocol === 'https:' ? Protocol.HTTPS : Protocol.HTTP
    ci.host           = host
    ci.port           = Number(port) || urlObj.protocol === 'https:' ? 443 : 80
    ci.url            = req.url || ''
    ci.headers        = req.headers
    ci.ip             = this.router.getIp(req)
    
    // Following fields are unrelated / irrelevant for 3rd party
    ci.msOffset       = 0
    ci.lastEventTs    = 0

    try {
      await this.router.verifyConnection(rc, ci, si, apiName)
    } catch (err) {
      res.writeHead(404, {
        [HTTP.HeaderKey.contentLength] : 0,
        connection                     : 'close' 
      })

      res.end()
      return
    }

    const encProvider   = ObopayHttpsClient.getEncProvider(),
          httpsProvider = new HttpsServerProvider(rc, ci, this.router, res, encProvider, this)

    si.provider = httpsProvider

    const reqId     : number              = Date.now(),
          apiParams : Mubble.uObject<any> = {}

    this.providerMap.set(httpsProvider, reqId)
    
    try {

      if(req.method != POST)
        throw new Mubble.uError(SecurityErrorCodes.INVALID_REQUEST_METHOD,
                                `${req.method} not supported.`)

      ObopayHttpsClient.verifyClientRequest(rc, encProvider, ci.headers, ci.ip)

      const streams     = encProvider.decodeBody([req], ci.headers[HTTP.HeaderKey.bodyEncoding], false),
            stream      = new UStream.ReadStreams(rc, streams),
            bodyStr     = (await stream.read()).toString()

      await ObopayHttpsClient.addRequestToMemory(ci.headers[HTTP.HeaderKey.requestTs],
                                                 ci.headers[HTTP.HeaderKey.clientId],
                                                 apiName,
                                                 bodyStr)

      Object.assign(apiParams, JSON.parse(bodyStr))

    } catch(err) {
      this.refRc.isError() && this.refRc.error(this.refRc.getName(this),
                                               'Error in verifying client request.',
                                               err)

      if(err.code in SecurityErrorCodes)
        httpsProvider.sendProtocolErrorResponse(rc, err.code)
      else
        httpsProvider.sendErrorResponse(rc, err.code)
    }

    httpsProvider.processRequest(rc, apiName, apiParams, reqId)
  }

  markFinished(provider: HttpsServerProvider) {
    this.providerMap.delete(provider)
  }

  cbTimerPing() {
    const notBefore = Date.now() - HTTP_TIMEOUT_MS,
          rc        = this.refRc,
          len       = this.providerMap.size

    for (const [provider, lastTs] of this.providerMap) {
      if (lastTs < notBefore) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Timing out a request')
        provider.sendErrorResponse(rc, XmnError.RequestTimedOut)
      } else if (len === 1) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Requests checked and found active')
      }
    }
  }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Https Server Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

export class HttpsServerProvider implements XmnProvider {

  private finished    : boolean     = false
  private wireRequest : WireRequest

  constructor(private refRc       : RunContextServer,
              private ci          : ConnectionInfo,
              private router      : XmnRouterServer,
              private res         : http.ServerResponse,
              private encProvider : HttpsEncProvider,
              private server      : HttpsServer) {

  }

  send(rc : RunContextServer, woArr : Array<WireObject>) {
    const data = woArr[0] as WireReqResp

    if(this.finished) {
      rc.isWarn() && rc.warn(rc.getName(this), `Request ${data.name} already processed.`)
      return
    }

    const headers = {
            [HTTP.HeaderKey.clientId]      : this.ci.headers[HTTP.HeaderKey.clientId],
            [HTTP.HeaderKey.versionNumber] : this.ci.headers[HTTP.HeaderKey.versionNumber],
            [HTTP.HeaderKey.symmKey]       : this.encProvider.encodeResponseKey(),
            [HTTP.HeaderKey.contentType]   : HTTP.HeaderValue.stream
          }

    const body       = {error : data.errorCode, data : data.data},
          encBodyObj = this.encProvider.encodeBody(body, true)

    headers[HTTP.HeaderKey.bodyEncoding] = encBodyObj.bodyEncoding
    encBodyObj.contentLength ? headers[HTTP.HeaderKey.contentLength]    = encBodyObj.contentLength
                             : headers[HTTP.HeaderKey.transferEncoding] = HTTP.HeaderValue.chunked

    this.res.writeHead(200, headers)
         
    encBodyObj.streams.push(this.res)
    const stream = new UStream.WriteStreams(rc, encBodyObj.streams)

    stream.write(encBodyObj.dataStr)

    this.finished = true
    this.server.markFinished(this)
    this.router.providerClosed(rc, this.ci)
  }

  requestClose() {

  }

  processRequest(rc        : RunContextServer,
                 apiName   : string,
                 apiParams : Mubble.uObject<any>,
                 reqId     : number) {

    this.wireRequest = new WireRequest(apiName, apiParams, reqId)
    this.router.providerMessage(rc, this.ci, [this.wireRequest])
  }

  sendErrorResponse(rc : RunContextServer, errorCode : string) {

    const wo = new WireReqResp(this.wireRequest.name,
                               this.wireRequest.ts,
                               {},
                               errorCode)

    this.send(rc, [wo])
  }

  sendProtocolErrorResponse(rc : RunContextServer, errorCode : SecurityError) {

    const wo = new WireReqResp(this.wireRequest.name,
                               this.wireRequest.ts,
                               SecurityError[errorCode] as any,
                               SUCCESS)

    this.send(rc, [wo])
  }
}