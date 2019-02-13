/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http                    from 'http'
import * as https                   from 'https'

import {XmnRouterServer}            from './xmn-router-server'
import {ActiveProviderCollection}   from '@mubble/core'
import {HttpServer}                 from './http-server'
import {HttpsServer}                from './https-server'
import {WsServer}                   from './ws-server'
import {WssServer}                  from './wss-server'
import {RunContextServer}           from '../rc-server'
import {clusterWorker}              from '../cluster/worker'


export enum WEB_SERVER_TYPE {HTTP, HTTPS, WEB_SOCKET}

export interface WebConfig {
  port : number
}

export interface HttpConfig extends WebConfig {
}

export interface WebsocketConfig extends WebConfig {
}

export interface WssConfig extends WebConfig {
  key  ?: string
  cert ?: string
}

export interface HttpsConfig extends WebConfig {
  key  ?: string
  cert ?: string
}

export class Web {

  private httpConfig      : HttpConfig      | undefined
  private websocketConfig : WebsocketConfig | undefined
  private httpsConfig     : HttpsConfig     | undefined
  private wssConfig       : WssConfig       | undefined

  private httpServer      : http.Server 
  private wsHttpServer    : http.Server
  private httpsServer     : https.Server
  private wssServer       : https.Server

  private router          : XmnRouterServer

  wsReqManager            : WsServer
  wssReqManager           : WssServer

  constructor() {
    if (web) throw('Router is singleton. It cannot be instantiated again')
  }

  init( rc               : RunContextServer,
        router           : XmnRouterServer,
        httpConfig      ?: HttpConfig, 
        websocketConfig ?: WebsocketConfig, 
        httpsConfig     ?: HttpsConfig,
        wssConfig       ?: WssConfig) : void {

    this.httpConfig      = httpConfig
    this.websocketConfig = websocketConfig
    this.httpsConfig     = httpsConfig
    this.wssConfig       = wssConfig
    this.router          = router

    if (this.httpConfig) {
      const httpReqManager = new HttpServer(rc, router , false)
      this.httpServer      = http.createServer(httpReqManager.requestHandler.bind(httpReqManager))
    }

    if (this.websocketConfig) {
      let wsServer: http.Server 
      if (this.httpConfig && this.httpConfig.port === this.websocketConfig.port) {
        wsServer = this.httpServer
      } else {
        wsServer = this.wsHttpServer = http.createServer()
      }
      this.wsReqManager = new WsServer(rc, wsServer, router)
    }

    if (this.httpsConfig) {

      const port = this.httpsConfig.port

      if (this.httpConfig && this.httpConfig.port === port) {
        throw('https port cannot be same as http port')
      }
      if (this.websocketConfig && this.websocketConfig.port === port) {
        throw('https port cannot be same as ws port')
      }

      const httpReqManager = new HttpsServer(rc, router)
      this.httpsServer     = https.createServer(this.httpsConfig, httpReqManager.requestHandler.bind(httpReqManager))
    }

    if(this.wssConfig) {
      let wssServer : https.Server

      if(this.httpsConfig && this.httpsConfig.port === this.wssConfig.port) wssServer = this.httpsServer
      else wssServer = this.wssServer = https.createServer(this.wssConfig)

      this.wssReqManager = new WssServer(rc, router, wssServer)
    }
  }

  async start(rc: RunContextServer) {
    if (this.httpServer) await this.listen(rc, this.httpServer, this.httpConfig as WebConfig)
    if (this.wsHttpServer) await this.listen(rc, this.wsHttpServer, this.websocketConfig as WebConfig)
    if (this.httpsServer) await this.listen(rc, this.httpsServer, this.httpsConfig as WebConfig)
    if (this.wssServer) await this.listen(rc, this.wssServer, this.wssConfig as WebConfig)
  }

  listen(rc: RunContextServer, httpServer: http.Server | https.Server , config: WebConfig) {

    return new Promise((resolve, reject) => {

      httpServer.listen(config.port, (err: any) => {
        if (err) {
          rc.isError() && rc.error(rc.getName(this), 'http.listen failed', config.port)
          return reject(err)
        }
        resolve()
      })

      httpServer.on('close', () => {
        if (rc.runState.isStopping()) {
          rc.isStatus() && rc.status(rc.getName(this), 'Exiting on http close event')
          clusterWorker.voluntaryExit(rc)
        }

        rc.isError() && rc.error(rc.getName(this), 'HTTPServer received an unexpected close event. Shutting down!')
        process.exit(1)
      })

      httpServer.on('clientError', (err : any, socket : any) => {
        rc.isStatus() && rc.status(rc.getName(this), 'httpServer.clientError', err, 'ignoring')
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      })
    })
  }

  getActiveProviderCollection(rc : RunContextServer) : ActiveProviderCollection {
    return this.wsReqManager
  }
}
export const web = new Web()
