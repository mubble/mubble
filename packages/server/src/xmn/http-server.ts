/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
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
        WireObject
       }                              from '@mubble/core'
import {
        RunContextServer,
        RUN_MODE
       }                              from '../rc-server'
import {XmnRouterServer}              from './xmn-router-server'

export class HttpServer {

  constructor(private refRc: RunContextServer, private router: XmnRouterServer) {

  }

  requestHandler(req: http.IncomingMessage, res: http.ServerResponse) : void {

    const rc = this.refRc.copyConstruct('', 'http-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'got a new request')

    const urlObj    = url.parse(req.url || '')

    const ci           = {} as ConnectionInfo,
          [host, port] = (req.headers.host || '').split(':')

    ci.protocol       = Protocol.HTTP
    ci.host           = host
    ci.port           = port || (urlObj.protocol === 'https' ? 443 : 80)
    ci.url            = req.url || ''
    ci.headers        = req.headers
    ci.ip             = this.router.getIp(req)
    ci.msOffset       = 0
    
    ci.publicRequest  = true
    ci.provider       = new HttpServerProvider(rc, ci, this.router, req, res)

    ci.provider.processRequest(rc, urlObj)
  }
}

const SUPPORTED_METHODS = ['GET', 'POST']


class HttpServerProvider {

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private router      : XmnRouterServer,
              private req         : http.IncomingMessage, 
              private res         : http.ServerResponse) {

  }
  async processRequest(rc: RunContextServer, urlObj: url.Url) {

    const wireRequest = await this.readRequest(rc, urlObj)
    if (!wireRequest) return

    this.router.providerMessage(rc, this.ci, [wireRequest])
    // The response is received in send
  }

  async readRequest(rc: RunContextServer, urlObj: url.Url): Promise<WireRequest | null> {

    const req = this.req,
          pathName = urlObj.pathname || '',
          urlName = pathName.startsWith('/') ? pathName.substr(1) : pathName,
          wr  = new WireRequest(urlName, {}, Date.now())

    if (SUPPORTED_METHODS.indexOf(req.method || '') === -1) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Rejecting request with invalid method', req.method)
      this.rejectRequest(rc)
      return null
    }

    let body: any
    if (req.method === 'GET') {
      body = querystring.parse(urlObj.query || '')
    } else { // POST
      body = await this.parseBody(rc)
    }

    if (body === null) {
      this.rejectRequest(rc)
      return null
    }

    for (const key in body) (wr.data as any)[key] = body[key]
    return wr
  }


  send(rc: RunContextServer, data: WireObject): void {

    const res = this.res

    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify(data))
  }

  private parseBody(rc: RunContextServer) {
    /*
     * content-type (mime) : application/x-www-form-urlencoded
     *                       multipart/form-data; boundary="boundary-content_example";
     *                       https://en.wikipedia.org/wiki/MIME
     *
     * content-encoding    : normally absent for request (set to gzip likes in response)
     *
     */

    return new Promise<object | null>((resolve) => {

      let body        = '',
          req         = this.req,
          ct          = req.headers['content-type'] || '',
          cleaned     = false,
          lastDataTS  = 0, timer = null

      req.on('data', (data) => {
        body += data
      })

      req.on('end', () => {
        if (ct.indexOf('application/x-www-form-urlencoded') !== -1) {
          resolve(querystring.parse(body))
        } else {
          try {
            const resp = JSON.parse(body)
            resolve(resp)
          } catch(err) {
            rc.isDebug() && rc.debug(rc.getName(this), 'Could not parse body. Will be available as data')
            resolve({data: body} as object)
          }
        }
      })

      req.on('error', (err) => {
        rc.isWarn() && rc.warn(rc.getName(this), 'Received error while parsing body', err)
        this.rejectRequest(rc)
        resolve(null)
      })
    })
  }

  private rejectRequest(rc: RunContextServer) {

    const res = this.res
    res.writeHead(200)

  }
}