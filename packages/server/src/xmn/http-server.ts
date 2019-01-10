/*------------------------------------------------------------------------------
   About      : Http(s) server
   
   Created on : Tue Jul 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http          from 'http'
import * as urlModule     from 'url'
import * as querystring   from 'querystring'
import * as zlib          from 'zlib'

import {
        ConnectionInfo,
        Protocol,
        WireRequest,
        WireObject,
        XmnError,
        HTTP,
        WireReqResp,
        XmnProvider
       }                              from '@mubble/core'
import {
        RunContextServer
       }                              from '../rc-server'
import { UStream }                    from '../util/mubble-stream'
       
import {XmnRouterServer}              from './xmn-router-server'

import * as mime                      from 'mime-types'

const TIMER_FREQUENCY_MS    = 10 * 1000 // to detect timed-out requests
const HTTP_TIMEOUT_MS       = 60 * 1000 // timeout in ms
const MIN_SIZE_TO_COMPRESS  = 2000

export class HttpServer {

  private providerMap : Map<HttpServerProvider, number> 
  private timerPing   : NodeJS.Timer

  constructor(private refRc: RunContextServer, private router: XmnRouterServer, private secure : boolean) {
    this.providerMap  = new Map()
    this.timerPing    = setInterval(this.cbTimerPing.bind(this), TIMER_FREQUENCY_MS)
  }

  async requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {

    const rc = this.refRc.copyConstruct('', 'http-request')

    const urlObj      = urlModule.parse(req.url || ''),
          pathName    = urlObj.pathname || '',
          ar          = (pathName.startsWith('/') ? pathName.substr(1) : pathName).split('/'),
          apiName     = ar[0],
          reqId       = Number(ar[1]) || Date.now()

    const ci           = {} as ConnectionInfo,
          [host, port] = (req.headers.host || '').split(':')

    ci.protocol       = this.secure ? Protocol.HTTPS : Protocol.HTTP
    ci.host           = host
    ci.port           = Number(port) || (urlObj.protocol === 'https:' ? 443 : 80)
    ci.url            = req.url || ''
    ci.headers        = req.headers
    ci.ip             = this.router.getIp(req)

    // Following fields are unrelated / irrelevant for 3rd party / server to server 
    // communication
    ci.msOffset       = 0
    ci.lastEventTs    = 0
    ci.location       = ''
    ci.networkType    = ''
    ci.publicRequest  = false

    try {
      await this.router.verifyConnection(rc, ci, apiName)
    } catch (err) {
      res.writeHead(404, {
        [HTTP.HeaderKey.contentLength]  : 0,
        connection                      : 'close' 
      })
      res.end()
      return
    }

    const httpProvider = new HttpServerProvider(rc, ci, this.router, req, res, this)
    ci.provider       = httpProvider
    this.providerMap.set(httpProvider , Date.now())
    httpProvider.processRequest(rc, apiName, reqId, urlObj.query || '')
  }

  markFinished(provider: HttpServerProvider) {
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
      } else if (rc.isDebug() && len === 1) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Requests checked and found active')
      }
    }
  }
  
}

export class HttpServerProvider implements XmnProvider {

  private finished = false
  private wireRequest: WireRequest

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private router      : XmnRouterServer,
              private req         : http.IncomingMessage, 
              private res         : http.ServerResponse,
              private server      : HttpServer
  ) {

  }

  async processRequest(rc: RunContextServer, apiName: string, reqId: number, query: string) {

    const req         = this.req
    this.wireRequest  = new WireRequest(apiName, {}, reqId)

    switch (this.req.method) {
      case 'GET':
      Object.assign(this.wireRequest.data, querystring.parse(query))
      break

      case 'POST':
      Object.assign(this.wireRequest.data, await this.parseBody(rc))
      break
      
      case 'HEAD':
      break

      default:
      rc.isWarn() && rc.warn(rc.getName(this), 'Rejecting request with invalid method', req.method, apiName)
      return this.sendErrorResponse(rc, XmnError.UnAuthorized)
    }

    this.router.providerMessage(rc, this.ci, [this.wireRequest])
  }

  send(rc: RunContextServer, wbs: WireObject[]): void {
    
    const data : WireReqResp = wbs[0] as WireReqResp

    if (this.finished) {
      rc.isWarn() && rc.warn(rc.getName(this), data.name, 'is already finished. Replying too late?', data)
      return
    }

    const res     = this.res,
          result  = JSON.stringify(data),
          headers = {
            [HTTP.HeaderKey.contentType]    :  mime.contentType('json') as string,
            // Default close, this may be passed as a param to this function to avoid for certain requests
            connection                      : 'close' 
          },
          streams = [res]
    
    if (result.length > MIN_SIZE_TO_COMPRESS) {
      headers[HTTP.HeaderKey.contentEncoding] = HTTP.HeaderValue.deflate
      streams.unshift(zlib.createDeflate() as any)
    } else {
      headers[HTTP.HeaderKey.contentLength]   = String(Buffer.byteLength(result))
    }    
    res.writeHead(data.errorCode ? XmnError.errorCode : 200, headers)
    new UStream.WriteStreams(rc, streams).write(result)

    this.finished = true
    this.server.markFinished(this)
    this.router.providerClosed(rc, this.ci)
  }

  public requestClose() {
    
  }

  sendErrorResponse(rc: RunContextServer, errorCode: string) {
    const wo = new WireReqResp(this.wireRequest.name, this.wireRequest.ts, {error : errorCode})
    this.send(rc, [wo])
  }

  private async parseBody(rc: RunContextServer) {
    /*
     * content-type (mime) : application/x-www-form-urlencoded
     *                       multipart/form-data; boundary="boundary-content_example";
     *                       https://en.wikipedia.org/wiki/MIME
     *
     * content-encoding    : normally absent for request (set to gzip likes in response)
     */

    const data    = (await new UStream.ReadStreams(rc, [this.req]).read()).toString(),
          headers = this.ci.headers
    
    switch (headers[HTTP.HeaderKey.contentType]) {
      case HTTP.HeaderValue.form:
        return querystring.parse(data)

      default:
        try {
          return JSON.parse(data)
        } catch (err) {
          rc.isDebug() && rc.debug(rc.getName(this), 'Could not parse post data as json', data)
          return {data}
        }
    }
  }
}