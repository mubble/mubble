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
        Leader,
        WEB_SOCKET_URL
       }                              from '@mubble/core'
import {
        RunContextServer,
        RUN_MODE
       }                              from '../rc-server'
import {XmnRouterServer}              from './xmn-router-server'
import {EncProviderServer}            from './enc-provider-server'

const PING_FREQUENCY_MS = 29 * 1000 // Don't change this as ephemeral events travel with ping

export class WsServer {

  private wsServer  : ws.Server
  private socketMap : Map<ServerWebSocket, number> 
  private timerPing : number
  
  constructor(private refRc: RunContextServer, httpServer: http.Server, private router: XmnRouterServer) {

    this.wsServer = new ws.Server({
      server: httpServer
    })
    this.wsServer.on('connection', this.onConnection.bind(this))

    this.socketMap = new Map()
    this.timerPing = setInterval(this.cbTimerPing.bind(this), PING_FREQUENCY_MS)
  }

  async onConnection(socket : any) {

    try {

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
      ci.lastEventTs    = 0

      ci.publicRequest  = mainUrl === WEB_SOCKET_URL.PUBLIC
      
      const encProvider    = new EncProviderServer(rc, ci),
            headerBuffer   = new Buffer(header, 'base64')

      encProvider.extractHeader(rc, headerBuffer)

      const pk = this.router.getPrivateKeyPem(rc, ci)
      encProvider.decodeHeader(rc, headerBuffer, pk)

      const webSocket = ci.provider = new ServerWebSocket(rc, ci, encProvider, 
                                        this.router, socket, this)
      
      webSocket.onMessage({data: new Buffer(body, 'base64')})

    } catch (e) {
      console.log(e)
      return socket.close()
    }
  }

  markActive(webSocket: ServerWebSocket) {
    this.socketMap.set(webSocket, Date.now())
  }

  markClosed(webSocket: ServerWebSocket) {
    this.socketMap.delete(webSocket)
  }

  cbTimerPing() {

    const notBefore    = Date.now() - PING_FREQUENCY_MS - 5000 /* extra time for network delays */

    for (const [webSocket, lastTs] of this.socketMap) {
      if (lastTs < notBefore) {
        const rc = this.refRc
        rc.isDebug() && rc.debug(rc.getName(this), 'Cleaning up a connection as no ping or close')
        webSocket.onClose()
      }
    }
  }
}

/*------------------------------------------------------------------------------
   ServerWebSocket
------------------------------------------------------------------------------*/
export class ServerWebSocket {

  private configSent          = false
  private connectionVerified  = false
  
  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private encProvider : EncProviderServer,
              private router      : XmnRouterServer,
              private ws          : WebSocket,
              private wss         : WsServer) {

    this.ws.onopen     = this.onOpen.bind(this)
    this.ws.onmessage  = this.onMessage.bind(this)
    this.ws.onclose    = this.onClose.bind(this)
    this.ws.onerror    = this.onError.bind(this)
  }

  private async sendConfig(rc: RunContextServer) {

    this.configSent = true

    const {key, encKey} = this.encProvider.getNewKey()
    
    const config = {
      msPingInterval : PING_FREQUENCY_MS, 
      syncKey        : encKey.toString('base64')
    } as WebSocketConfig

    await this.sendInternal(rc, new WireSysEvent(SYS_EVENT.WS_PROVIDER_CONFIG, config), Leader.CONFIG)

    // Update the key to new key
    this.ci.syncKey = key
  }

  onOpen() {
    const rc = this.refRc.copyConstruct('', 'ws-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'Websocket onOpen()')
  }

  public onMessage(msgEvent: any) {

    if (!this.ci.provider) return
    
    const rc = this.refRc.copyConstruct('', 'ws-request')
    const data = msgEvent.data

    this.processMessage(rc, data)
  }

  private async processMessage(rc: RunContextServer, data: Buffer) {

    this.wss.markActive(this)

    const decodedData : WireObject[] = await this.encProvider.decodeBody(rc, data)

    rc.isDebug() && rc.debug(rc.getName(this), 'processMessage', {
      incomingLength  : data.length,
      type            : data.constructor ? data.constructor.name : undefined,
      key             : (<any>this.ci.headers)['sec-websocket-key'],
      messages        : decodedData.length,
      firstMsg        : decodedData[0].name
    })

    if (!this.connectionVerified) {
      this.connectionVerified = true
      await this.router.verifyConnection(rc, this.ci)
    }

    this.router.providerMessage(rc, this.ci, decodedData)
  }

  public async send(rc: RunContextServer, data: WireObject) {

    if (!this.ci.provider) return
    
    if (!this.configSent) await this.sendConfig(rc)
    this.sendInternal(rc, data)
  }

  private async sendInternal(rc: RunContextServer, data: WireObject, msgType ?: string) {

    rc.isDebug() && rc.debug(rc.getName(this), 'sending', data)
    const msg = await this.encProvider.encodeBody(rc, data, msgType)

    this.ws.send(msg)
  }
  

  public onError(err: any) {

    if (!this.ci.provider) return
    
    const rc : RunContextServer = this.refRc.copyConstruct('', 'ws-request')
    rc.isError() && rc.error(rc.getName(this), 'Websocket onError()', err)
    this.cleanup()
    this.router.providerFailed(rc, this.ci)
  }

  public onClose() {

    if (!this.ci.provider) return

    this.wss.markClosed(this)

    const rc : RunContextServer = this.refRc.copyConstruct('', 'ws-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'Websocket onClose()')
    this.cleanup()
    this.router.providerClosed(rc, this.ci)
  }

  public processSysEvent(rc: RunContextServer, se: WireSysEvent) {

    if (!this.ci.provider) return
    
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
