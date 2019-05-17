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
         WireRequest
       }                      from '@mubble/core'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer }    from './xmn-router-server'
import { ObopayHttpsClient }  from './obopay-https-client'
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

    rc.isStatus() && rc.status(rc.getName(this), 'Recieved third party https request.', req.url)

    const urlObj         = urlModule.parse(req.url || ''),
          pathName       = urlObj.pathname || '',
          ar             = (pathName.startsWith('/') ? pathName.substr(1) : pathName).split('/'),
          apiName        = ar[0],
          encRequestPath = ar[1]

    const ci             = {} as ConnectionInfo,
          [host, port]   = (req.headers.host || '').split(':')

    ci.protocol          = urlObj.protocol === 'https:' ? Protocol.HTTPS : Protocol.HTTP
    ci.host              = host
    ci.port              = Number(port) || urlObj.protocol === 'https:' ? 443 : 80
    ci.url               = req.url || ''
    ci.headers           = req.headers
    ci.ip                = this.router.getIp(req)

    try {
      await this.router.verifyConnection(rc, ci, apiName)
    } catch (err) {
      res.writeHead(404, {
        [HTTP.HeaderKey.contentLength] : 0,
        connection                     : 'close' 
      })

      res.end()
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
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Https Server Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

export class HttpsThirdServerProvider implements XmnProvider {

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

    
    switch (this.req.method) {
      case GET  :
        apiParams.extraParams = querystring.parse(query)
        break

      case POST :
        apiParams.extraParams = await this.parseBody(rc)
        break

      default   :
        rc.isWarn() && rc.warn(rc.getName(this), 'Rejecting request with invalid method', this.req.method, apiName)
    }
    
    const wo = new WireRequest(apiName, apiParams, reqId)
    this.router.providerMessage(rc, this.ci, [wo])
  }

  send(rc : RunContextServer, data : any) {
    rc.isDebug() && rc.debug(rc.getName(this), 'sending', data)

    this.res.writeHead(200)

    if(!(data instanceof Buffer) || typeof data != 'string')
      data = Buffer.from(JSON.stringify(data))

    const streams = [this.res],
          uStream = new UStream.WriteStreams(rc, streams)

    uStream.write(data)

    this.server.markFinished(this)
    // this.router.providerClosed(rc, this.ci)
  }

  requestClose() {

  }

  private async parseBody(rc: RunContextServer) {
    
    const data    = (await new UStream.ReadStreams(rc, [this.req]).read()).toString(),
          headers = this.ci.headers
    
    switch (headers[HTTP.HeaderKey.contentType]) {
      case HTTP.HeaderValue.form :
        return querystring.parse(data)

      default                    :
        try {
          return JSON.parse(data)
        } catch (err) {
          rc.isDebug() && rc.debug(rc.getName(this), 'Could not parse post data as json', data)
          return {data}
        }
    }
  }
}