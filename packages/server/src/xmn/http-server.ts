/*------------------------------------------------------------------------------
   About      : Http(s) server
   
   Created on : Tue Jul 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http          from 'http'
import * as url           from 'url'
import * as querystring   from 'querystring'
import * as lo            from 'lodash'

import {
        ConnectionInfo,
        Protocol,
        WireRequest,
        WireObject,
        XmnError,
        HTTP,
        WireReqResp
       }                              from '@mubble/core'
import {
        RunContextServer,
        RUN_MODE
       }                              from '../rc-server'
import { UStream }                    from '../util/mubble-stream'
       
import {XmnRouterServer}              from './xmn-router-server'
import * as mime                      from 'mime-types'

const TIMER_FREQUENCY_MS = 10 * 1000 // to detect timed-out requests
const HTTP_TIMEOUT_MS    = 60 * 1000 // timeout in ms

export class HttpServer {

  private providerMap : Map<HttpServerProvider, number> 
  private timerPing : number

  constructor(private refRc: RunContextServer, private router: XmnRouterServer, private secure : boolean) {
    this.providerMap  = new Map()
    this.timerPing    = setInterval(this.cbTimerPing.bind(this), TIMER_FREQUENCY_MS)
  }

  async requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {

    const rc = this.refRc.copyConstruct('', 'http-request')

    const urlObj    = url.parse(req.url || '')

    const ci           = {} as ConnectionInfo,
          [host, port] = (req.headers.host || '').split(':')

    ci.protocol       = this.secure ? Protocol.HTTPS : Protocol.HTTP
    ci.host           = host
    ci.port           = Number(port) || (urlObj.protocol === 'https' ? 443 : 80)
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
      await this.router.verifyConnection(rc, ci)
    } catch (err) {
      res.writeHead(404, {
        [HTTP.HeaderKey.contentLength]  : 0,
        connection                      : 'close' 
      })
      res.end()
      return
    }

    ci.provider       = new HttpServerProvider(rc, ci, this.router, req, res, this)
    this.providerMap.set(ci.provider, Date.now())
    ci.provider.processRequest(rc, urlObj)
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

export class HttpServerProvider {

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

  async processRequest(rc: RunContextServer, urlObj: url.Url) {

    const req         = this.req,
          pathName    = urlObj.pathname || '',
          apiName     = pathName.startsWith('/') ? pathName.substr(1) : pathName

    this.wireRequest  = new WireRequest(apiName, {}, Date.now())

    switch (this.req.method) {
      case 'GET':
      Object.assign(this.wireRequest.data, querystring.parse(urlObj.query))
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

  send(rc: RunContextServer, data: WireObject , httpErrorStatus ?: string): void {
    
    if (this.finished) {
      rc.isWarn() && rc.warn(rc.getName(this), data.name, 'is already finished. Replying too late?', data)
      return
    }

    const res     = this.res,
          result  = JSON.stringify(data)

    res.writeHead(XmnError.errorCode || 200 , {
      [HTTP.HeaderKey.contentLength]  : result.length,
      [HTTP.HeaderKey.contentType]    :  mime.contentType('json') as string,
      // Default close, this may be passed as a param to this function to avoid for certain requests
      connection                      : 'close' 
    })
    res.end(result)
    this.finished = true
    this.server.markFinished(this)
    this.router.providerClosed(rc, this.ci)
  }

  sendErrorResponse(rc: RunContextServer, errorCode: string) {
    const wo = new WireReqResp(this.wireRequest.name, this.wireRequest.ts, {error : errorCode})
    this.send(rc, wo, errorCode)
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