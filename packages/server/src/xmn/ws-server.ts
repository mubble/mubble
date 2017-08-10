/*------------------------------------------------------------------------------
   About      : Websocket based communication manager
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import * as http          from 'http'
import * as ws            from 'ws'
import * as url           from 'url'
import * as lo            from 'lodash'
import {  
        ConnectionInfo,
        Protocol,
        WireObject,
        WebSocketConfig,
        WireSysEvent,
        SYS_EVENT,
        WIRE_TYPE,
        WEB_SOCKET_URL
       }                              from '@mubble/core'
import {
        RunContextServer,
        RUN_MODE
       }                              from '../rc-server'
import {XmnRouterServer}              from './xmn-router-server'
import {EncProviderServer}            from './enc-provider-server'

export class WsServer {

  private wsServer : ws.Server

  constructor(private refRc: RunContextServer, httpServer: http.Server, private router: XmnRouterServer) {

    this.wsServer = new ws.Server({
      server: httpServer
    })
    this.wsServer.on('connection', this.onConnection.bind(this))
  }

  onConnection(socket : any) {

    const rc = this.refRc.copyConstruct('', 'ws-connection')

    rc.isDebug() && rc.debug(rc.getName(this), 'got a new connection')

    const req       = socket.upgradeReq,
          urlObj    = url.parse(req.url || ''),
          pathName  = urlObj.pathname || '' // it is like /engine.io/header/body

    let   [, mainUrl, header, body] = pathName.split('/')

    if (!(mainUrl === WEB_SOCKET_URL.PUBLIC || mainUrl === WEB_SOCKET_URL.PRIVATE) || !header || !body) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Ignoring websocket request with url', req.url)
      return socket.close()
    }

    header = decodeURIComponent(header)
    body   = decodeURIComponent(body)

    const ci           = {} as ConnectionInfo,
          [host, port] = (req.headers.host || '').split(':')

    ci.protocol       = Protocol.WEBSOCKET
    ci.host           = host
    ci.port           = port || (urlObj.protocol === 'wss' ? 443 : 80)
    ci.url            = mainUrl
    ci.headers        = req.headers
    ci.ip             = this.router.getIp(req)
    //ci.lastEventTs    = 0

    ci.publicRequest  = mainUrl === WEB_SOCKET_URL.PUBLIC
    
    const encProvider    = new EncProviderServer(rc, ci)
    encProvider.decodeHeader(rc, new Buffer(header, 'base64').toString())

    if (!this.router.verifyConnection(rc, ci)) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Ignoring websocket request with url', req.url)
      return socket.close()
    }

    ci.provider = new ServerWebSocket(rc, ci, encProvider, this.router, socket)
    ci.provider.processMessage(rc, new Buffer(body, 'base64').toString())
  }
}

class ServerWebSocket {

  private configSent = false

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private encProvider : EncProviderServer,
              private router      : XmnRouterServer,
              private ws          : WebSocket) {

    this.ws.onopen     = this.onOpen.bind(this)
    this.ws.onmessage  = this.onMessage.bind(this)
    this.ws.onclose    = this.onClose.bind(this)
    this.ws.onerror    = this.onError.bind(this)
  }

  private sendConfig(rc: RunContextServer) {

    const config = {
      msPingInterval: 29000 // 29 secs
    } as WebSocketConfig

    this.send(rc, new WireSysEvent(SYS_EVENT.WS_PROVIDER_CONFIG, config))

    this.encProvider.sendConfig(rc)
    this.configSent = true
  }

  onOpen() {
    const rc = this.refRc.copyConstruct('', 'ws-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'Websocket onOpen()')
  }

  onMessage(msgEvent: any) {

    const rc = this.refRc.copyConstruct('', 'ws-request')
    const data = msgEvent.data
    
    this.processMessage(rc, data)
  }

  processMessage(rc: RunContextServer, data: string) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Websocket processMessage() length:', data.length,
            'key:', (<any>this.ci.headers)['sec-websocket-key'] )

    const decodedData = this.encProvider.decodeBody(rc, data)
    this.router.providerMessage(rc, this.ci, decodedData)
  }

  send(rc: RunContextServer, data: WireObject): void {

    rc.isDebug() && rc.debug(rc.getName(this), 'sending', data)

    if (!this.configSent && data.type !== WIRE_TYPE.SYS_EVENT) {
      this.sendConfig(rc)
    }
    const msg = this.encProvider.encodeBody(rc, data)
    this.ws.send(msg)
  }

  onError(err: any) {
    const rc = this.refRc.copyConstruct('', 'ws-request')
    rc.isWarn() && rc.warn(rc.getName(this), 'Websocket onError()', err)
    this.cleanup()
    this.router.providerFailed(rc, this.ci)
  }

  onClose() {
    const rc = this.refRc.copyConstruct('', 'ws-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'Websocket onClose()')
    this.cleanup()
    this.router.providerClosed(rc, this.ci)
  }

  processSysEvent(rc: RunContextServer, se: WireSysEvent) {

    if (se.name === SYS_EVENT.PING) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Received ping')
      return true
    } else {
      return false
    }
  }

  private cleanup() {
    this.ci.provider = null
  }  
  
}
