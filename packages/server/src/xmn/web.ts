/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http              from 'http'
import {XmnRouter}            from '@mubble/core'

import {HttpXmn}              from './http-xmn'
import {WsXmn}                from './ws-xmn'
import {RunContextServer}     from '../rc-server'
import {clusterWorker}        from '../cluster/worker'


export enum WEB_SERVER_TYPE {HTTP, HTTPS, WEB_SOCKET}

export interface WebConfig {
  port : number
}

export interface HttpConfig extends WebConfig {
}

export interface WebsocketConfig extends WebConfig {
}

export interface HttpsConfig extends WebConfig {
  key  : string
  cert : string
}

export class Web {

  private httpConfig      : HttpConfig      | undefined
  private websocketConfig : WebsocketConfig | undefined
  private httpsConfig     : HttpsConfig     | undefined

  private httpServer      : http.Server 
  private wsHttpServer    : http.Server
  private httpsServer     : http.Server

  private router          : XmnRouter

  constructor() {
    if (web) throw('Router is singleton. It cannot be instantiated again')
  }

  init( rc               : RunContextServer,
        router           : XmnRouter,
        httpConfig      ?: HttpConfig, 
        websocketConfig ?: WebsocketConfig, 
        httpsConfig     ?: HttpsConfig) : void {

    this.httpConfig      = httpConfig
    this.websocketConfig = websocketConfig
    this.httpsConfig     = httpsConfig
    this.router          = router

    if (this.httpConfig) {
      const httpReqManager = new HttpXmn()
      this.httpServer      = http.createServer(httpReqManager.requestHandler.bind(httpReqManager))
    }

    if (this.websocketConfig) {
      let wsServer: http.Server 
      if (this.httpConfig && this.httpConfig.port === this.websocketConfig.port) {
        wsServer = this.httpServer
      } else {
        wsServer = this.wsHttpServer = http.createServer()
      }
      const wsReqManager = new WsXmn(rc, wsServer, router)
    }

    if (this.httpsConfig) {

      const port = this.httpsConfig.port

      if (this.httpConfig && this.httpConfig.port === port) {
        throw('https port cannot be same as http port')
      }
      if (this.websocketConfig && this.websocketConfig.port === port) {
        throw('https port cannot be same as ws port')
      }

      const httpReqManager = new HttpXmn()
      this.httpsServer     = http.createServer(httpReqManager.requestHandler.bind(httpReqManager))
    }
  }

  async start(rc: RunContextServer) {
    if (this.httpServer) await this.listen(rc, this.httpServer, this.httpConfig as WebConfig)
    if (this.wsHttpServer) await this.listen(rc, this.wsHttpServer, this.websocketConfig as WebConfig)
    if (this.httpsServer) await this.listen(rc, this.httpsServer, this.httpsConfig as WebConfig)
  }

  listen(rc: RunContextServer, httpServer: http.Server, config: WebConfig) {

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
}
export const web = new Web()
