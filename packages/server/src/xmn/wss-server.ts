/*------------------------------------------------------------------------------
   About      : Websocket based request handler
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         WireObject,
         XmnProvider,
         ConnectionInfo,
         SessionInfo,
         Protocol,
         WssProviderConfig,
         WssErrorCode
       }                      from '@mubble/core'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer } 		from './xmn-router-server'
import { ObopayWssClient }    from './obopay-wss-client'
import { WssEncProvider }     from './wss-enc-provider'
import * as ws                from 'ws'
import * as https             from 'https'
import * as http 							from 'http'
import * as urlModule         from 'url'

const SLASH_SEP = '/'

export class WssServer {

  private server    : ws.Server
  private socketMap : Map<WssServerProvider, number>

  constructor(private refRc  : RunContextServer,
              private router : XmnRouterServer,
              httpsServer    : https.Server) {

    this.socketMap = new Map()            
		this.server    = new ws.Server({
			server : httpsServer
		})

    this.server.on('connection', this.establishHandshake.bind(this))
	}
	
	private async establishHandshake(socket : WebSocket, req : http.IncomingMessage) {

    const rc = this.refRc.copyConstruct(undefined, 'handshake') as RunContextServer

    rc.isStatus() && rc.status(rc.getName(this), 'Recieved a new connection. Establishing handshake.')

    try {
      if(!req.url) throw new Error('Request URL absent.')

      const url          = urlModule.parse(req.url),
            path         = url.pathname || '',
            [host, port] = (req.headers.host || '').split(':')

      const [, version, clientId, encData] = path.split(SLASH_SEP)

      if(!version || !clientId || !encData) throw new Error(`Invalid URL path ${path}.`)

      const isAppClient = ObopayWssClient.verifyClientRequest(rc, version, clientId),
            publicKey   = isAppClient ? undefined
                                      : ObopayWssClient.getClientPublicKey(clientId),
            encProvider = ObopayWssClient.getEncProvider(),
            body        = encProvider.decodeRequestUrl(encData, publicKey),
            wssConfig   = ObopayWssClient.getWssConfig(body.wssConfig, encProvider),
            ci          = {} as ConnectionInfo,
            si          = {} as SessionInfo

      ci.shortName      = clientId
      ci.protocol       = Protocol.WEBSOCKET
      ci.host           = host
      ci.port           = Number(port) || (url.protocol === 'wss' ? 443 : 80)
      ci.url            = path
      ci.headers        = req.headers
      ci.ip             = this.router.getIp(req)
      ci.lastEventTs    = 0
      ci.lastRequestTs  = 0
      ci.customData     = wssConfig.custom

      si.publicRequest  = false
      si.useEncryption  = true

      const wssProvider = new WssServerProvider(rc, socket, ci, this.router, encProvider, wssConfig, this)
      si.provider       = wssProvider

      await this.router.verifyConnection(rc, ci, si)

      const encConfig = encProvider.encodeResponseConfig(wssConfig)
      socket.send(encConfig)

      this.socketMap.set(wssProvider, body.tsMicro)
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), 'Error in establishing handshake.', err)
      socket.close(WssErrorCode.HANDSHAKE_FAILURE)
    }
  }
  
  public markClosed(wssProvider : WssServerProvider) {
    this.socketMap.delete(wssProvider)
  }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Wss Server Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

export class WssServerProvider implements XmnProvider {

  public constructor(private refRc       : RunContextServer,
                     private socket      : WebSocket,
                     private ci          : ConnectionInfo,
                     private router      : XmnRouterServer,
                     private encProvider : WssEncProvider,
                     private wssConfig   : WssProviderConfig,
                     private wssServer   : WssServer) {

    this.socket.onopen     = this.onOpen.bind(this)
    this.socket.onmessage  = this.onMessage.bind(this)
    this.socket.onclose    = this.onClose.bind(this)
    this.socket.onerror    = this.onError.bind(this)
  }

  public send() {

  }

  public requestClose() {
    this.socket.close()
  }

  private onOpen() {
    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'WebSocket onopen()')
  }

  private onMessage(msgEvent : MessageEvent) {
    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'WebSocket onmessage()')

    const data = msgEvent.data
    this.processMessage(rc, data)
  }

  private async processMessage(rc : RunContextServer, data : Buffer) {

    const woArr = await this.encProvider.decodeBody(data)

    woArr[0].name !== 'PING' && rc.isDebug() && rc.debug(rc.getName(this), 'processMessage', {
      incomingLength  : data.length,
      type            : data.constructor ? data.constructor.name : undefined,
      key             : (<any>this.ci.headers)['sec-websocket-key'],
      messages        : woArr.length,
      firstMsg        : woArr[0].name
    })

    const tsVerified = woArr.every((wo : WireObject) => {
      return ObopayWssClient.verifyRequestTs(wo.ts, this.ci.lastRequestTs, this.wssConfig)
    })

    if(!tsVerified) {
      this.socket.close(WssErrorCode.INVALID_REQUESTTS)
      this.closeInternal(rc)
      return
    }

    this.router.providerMessage(rc, this.ci, woArr)
  }

  private onClose() {
    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'WebSocket onclose()')

    this.closeInternal(rc)
  }

  private closeInternal(rc : RunContextServer) {
    this.wssServer.markClosed(this)
    this.router.providerClosed(rc, this.ci)
  }

  private onError(err : Error) {
    this.wssServer.markClosed(this)

    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isError() && rc.error(rc.getName(this), 'WebSocket onerror()', err)
    this.router.providerFailed(rc, this.ci)
  }
}