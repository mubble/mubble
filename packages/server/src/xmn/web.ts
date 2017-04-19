/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http              from 'http'

import {HttpRequestManager}   from './http-request-manager'
import {WsXmn}                from './ws-xmn'
import {RunContext}           from '../util/run-context'
import {runState}             from '../util/run-state'
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

  constructor() {
    if (web) throw('Router is singleton. It cannot be instantiated again')
  }

  init( rc               : RunContext,
        httpConfig      ?: HttpConfig, 
        websocketConfig ?: WebsocketConfig, 
        httpsConfig     ?: HttpsConfig) : void {

    this.httpConfig      = httpConfig
    this.websocketConfig = websocketConfig
    this.httpsConfig     = httpsConfig

    if (this.httpConfig) {
      const httpReqManager = new HttpRequestManager()
      this.httpServer      = http.createServer(httpReqManager.requestHandler.bind(httpReqManager))
    }

    if (this.websocketConfig) {
      let wsServer: http.Server 
      if (this.httpConfig && this.httpConfig.port === this.websocketConfig.port) {
        wsServer = this.httpServer
      } else {
        wsServer = this.wsHttpServer = http.createServer()
      }
      const wsReqManager = new WsXmn(wsServer)
    }

    if (this.httpsConfig) {

      const port = this.httpsConfig.port

      if (this.httpConfig && this.httpConfig.port === port) {
        throw('https port cannot be same as http port')
      }
      if (this.websocketConfig && this.websocketConfig.port === port) {
        throw('https port cannot be same as ws port')
      }

      const httpReqManager = new HttpRequestManager()
      this.httpsServer     = http.createServer(httpReqManager.requestHandler.bind(httpReqManager))
    }
  }

  async start(rc: RunContext) {
    if (this.httpServer) await this.listen(rc, this.httpServer, this.httpConfig as WebConfig)
    if (this.wsHttpServer) await this.listen(rc, this.wsHttpServer, this.websocketConfig as WebConfig)
    if (this.httpsServer) await this.listen(rc, this.httpsServer, this.httpsConfig as WebConfig)
  }

  listen(rc: RunContext, httpServer: http.Server, config: WebConfig) {

    return new Promise((resolve, reject) => {

      httpServer.listen(config.port, (err: any) => {
        if (err) {
          rc.isError() && rc.error(this.constructor.name, 'http.listen failed', config.port)
          return reject(err)
        }
        resolve()
      })

      httpServer.on('close', () => {
        const rc = RunContext.getAdHoc()
        if (runState.isStopping()) {
          rc.isStatus() && rc.status(this.constructor.name, 'Exiting on http close event')
          clusterWorker.voluntaryExit(rc)
        }

        rc.isError() && rc.error(this.constructor.name, 'HTTPServer received an unexpected close event. Shutting down!')
        process.exit(1)
      })

      httpServer.on('clientError', (err : any, socket : any) => {
        const rc = RunContext.getAdHoc()
        rc.isStatus() && rc.status(this.constructor.name, 'httpServer.clientError', err, 'ignoring')
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      })
    })
  }
}
export const web = new Web()
