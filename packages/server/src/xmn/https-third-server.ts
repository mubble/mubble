/*------------------------------------------------------------------------------
   About      : Https server for third party who are not following our protocol
   
   Created on : Mon Feb 25 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         XmnProvider,
         XmnError,
         ConnectionInfo,
         Protocol,
         HTTP,
         Mubble,
         WireRequest,
         CustomData
       }                      from '@mubble/core'
import { ObopayHttpsClient }  from './obopay-https-client'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer }    from './xmn-router-server'
import { UStream }            from '../util'
import * as http              from 'http'
import * as urlModule         from 'url'
import * as querystring       from 'querystring'

const TIMER_FREQUENCY_MS = 10 * 1000,  // to detect timed-out requests
      HTTP_TIMEOUT_MS    = 60 * 1000,  // timeout in ms
      GET                = 'GET',
      POST               = 'POST'

export class HttpsThirdServer {

  private providerMap : Map<HttpsThirdServerProvider, number>

  constructor(private refRc : RunContextServer, private router : XmnRouterServer) {
    this.providerMap = new Map()

    setInterval(this.cbTimerPing.bind(this), TIMER_FREQUENCY_MS)
  }

  async requestHandler(req : http.IncomingMessage, res : http.ServerResponse) {

    const rc = this.refRc.copyConstruct('', 'https-request')

    rc.isStatus() && rc.status(rc.getName(this), 'Received third party https request.', req.url)

    const urlObj         = urlModule.parse(req.url || ''),
          pathName       = urlObj.pathname || '',
          ar             = (pathName.startsWith('/') ? pathName.substr(1) : pathName).split('/'),
          obopayStr      = ar[0],
          apiName        = ar[1],
          encRequestPath = ar[2]

    if(obopayStr !== ObopayHttpsClient.OBOPAY_STR) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Ending request with 404 response.')
      this.endRequestWithNotFound(res)
      return
    }

    const ci             = {} as ConnectionInfo,
          [host, port]   = (req.headers.host || '').split(':')

    ci.protocol          = Protocol.HTTP_THIRD
    ci.host              = host
    ci.port              = Number(port) || urlObj.protocol === 'https:' ? 443 : 80
    ci.url               = req.url || ''
    ci.headers           = req.headers
    ci.ip                = this.router.getIp(req)
    ci.customData        = {} as CustomData

    try {
      await this.router.verifyConnection(rc, ci, apiName)
    } catch (err) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Ending request with 404 response.', err)
      this.endRequestWithNotFound(res)
      return
    }

    let apiParams = {}
    if(encRequestPath) {
      const requestPath  = decodeURIComponent(encRequestPath),
            encProvider  = ObopayHttpsClient.getEncProvider()
            apiParams    = encProvider.decodeThirdPartyRequestPath(requestPath)
    }

    const httpsProvider  = new HttpsThirdServerProvider(rc, this.router, ci, req, res, this)

    ci.provider          = httpsProvider

    const now            = Date.now(),
          reqId          = now * 1000,
          query          = urlObj.query || ''

    this.providerMap.set(httpsProvider, now)
    await httpsProvider.processRequest(rc, apiName, apiParams, query, reqId)
  }

  markFinished(provider : HttpsThirdServerProvider) {
    this.providerMap.delete(provider)
  }

  cbTimerPing() {
    const notBefore = Date.now() - HTTP_TIMEOUT_MS,
          rc        = this.refRc,
          len       = this.providerMap.size

    for (const [provider, lastTs] of this.providerMap) {
      if (lastTs < notBefore) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Timing out a request')
        provider.send(rc, XmnError.RequestTimedOut)
      } else if (len === 1) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Requests checked and found active')
      }
    }
  }

  private endRequestWithNotFound(res : http.ServerResponse) {
    res.writeHead(404, {
      [HTTP.HeaderKey.contentLength] : 0,
      connection                     : 'close' 
    })

    res.end()
  }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Https Server Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

export class HttpsThirdServerProvider implements XmnProvider {

  private responseHeaders : http.OutgoingHttpHeaders = {}
  private finished        : boolean                  = false

  constructor(private refRc       : RunContextServer,
              private router      : XmnRouterServer,
              private ci          : ConnectionInfo,
              private req         : http.IncomingMessage,
              private res         : http.ServerResponse,
              private server      : HttpsThirdServer) {


  }

  async processRequest(rc        : RunContextServer,
                       apiName   : string,
                       apiParams : Mubble.uObject<any>,
                       query     : string,
                       reqId     : number) {

    let extraParams = {}
    
    rc.isDebug() && rc.debug(rc.getName(this), 'Request method.', this.req.method)

    switch (this.req.method) {
      case GET  :
        extraParams = this.parseQuery(rc, query)
        break

      case POST :
        extraParams = await this.parseBody(rc)
        break

      default   :
        rc.isWarn() && rc.warn(rc.getName(this), 'Rejecting request with invalid method', this.req.method, apiName)
    }

    apiParams = this.appendParams(rc, apiParams, extraParams)
    
    const wo = new WireRequest(apiName, apiParams, reqId)
    this.router.providerMessage(rc, this.ci, [wo])
  }

  send(rc : RunContextServer, data : any) {

    if(this.finished) {
      rc.isWarn() && rc.warn(rc.getName(this), `Request already processed.`)
      return
    }

    rc.isStatus() && rc.status(rc.getName(this), 'sending', data)

    this.res.writeHead(200, this.responseHeaders)

    if(!(data instanceof Buffer) || typeof data != 'string')
      data = Buffer.from(JSON.stringify(data))

    const streams = [this.res],
          uStream = new UStream.WriteStreams(rc, streams)

    uStream.write(data)

    this.finished = true
    this.server.markFinished(this)
    // this.router.providerClosed(rc, this.ci)
  }

  requestClose() {

  }

  getCookies() : Mubble.uObject<string> {

    const cookies = {} as Mubble.uObject<string>

    if(!this.ci.headers.cookie) return cookies

    const headerCookie = this.ci.headers.cookie as string,
          pairs        = headerCookie.split(';')

    for(const pair of pairs) {
      const parts    = pair.split('='),
            partsKey = parts.shift()

      if(partsKey === undefined) return cookies

      const cookieKey   = decodeURIComponent(partsKey.trim()),
            cookieValue = decodeURIComponent(parts.join('='))

      cookies[cookieKey] = cookieValue
    }

    return cookies
  }

  setCookies(cookies : Mubble.uObject<string>) {

    const pairs = [] as Array<string>

    for(const key in cookies) {
      const cookieKey   = encodeURIComponent(key),
            cookieValue = encodeURIComponent(cookies[key]),
            path        = '; path="/"',
            expiry      = `; expires=${new Date(Date.now() + 10 * 365 * 60 * 60 * 1000).toUTCString()} UTC`,
            pair        = [cookieKey, cookieValue].join('=') + expiry + path

      pairs.push(pair)
    }

    this.responseHeaders[HTTP.HeaderKey.setCookie] = pairs
  }

  redirect(rc : RunContextServer, url : string) {

    rc.isStatus() && rc.status(rc.getName(this), 'Redirecting to :', url, this.responseHeaders)
    this.responseHeaders[HTTP.HeaderKey.location] = url

    this.res.writeHead(302, this.responseHeaders)
    this.res.end()
    this.finished = true
    this.server.markFinished(this)
  }

  private async parseBody(rc: RunContextServer) {
    
    const data    = (await new UStream.ReadStreams(rc, [this.req]).read()).toString(),
          headers = this.ci.headers
    
    switch (headers[HTTP.HeaderKey.contentType]) {
      case HTTP.HeaderValue.form :
        return this.parseQuery(rc, data)

      default                    :
        try {
          return JSON.parse(data)
        } catch (err) {
          rc.isDebug() && rc.debug(rc.getName(this), 'Could not parse post data as json', data)
          return {data}
        }
    }
  }

  private appendParams(rc : RunContextServer, apiParams : Mubble.uObject<any>, extraParams : Mubble.uObject<any>) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Appending to api params.', apiParams, extraParams)

    for(const key in extraParams) {
      apiParams[key] = extraParams[key]
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'Final api params.', apiParams)

    return apiParams
  }

  private parseQuery(rc : RunContextServer, query : string) : Mubble.uObject<any> {

    rc.isDebug() && rc.debug(rc.getName(this), 'Parsing query.', query)

    const obj      = querystring.parse(query),
          keywords = {
                       true      : true,
                       false     : false,
                       null      : null,
                       undefined : undefined
                     } as Mubble.uObject<any>

    for(const key in obj) {
      if(key in keywords) {
        obj[key] = keywords[key]
      }
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'Query parsed.', query, obj)

    return obj
  }
}