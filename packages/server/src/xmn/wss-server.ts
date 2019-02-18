/*------------------------------------------------------------------------------
   About      : WebSocket based request handler
   
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
         WssErrorCode,
         WIRE_TYPE,
         SYS_EVENT,
         WireSysEvent
       }                      from '@mubble/core'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer } 		from './xmn-router-server'
import { ObopayWssClient }    from './obopay-wss-client'
import { WssEncProvider }     from './wss-enc-provider'
import * as ws                from 'ws'
import * as https             from 'https'
import * as http 							from 'http'
import * as urlModule         from 'url'

const SLASH_SEP         = '/',
      PING_FREQUENCY_MS = 29 * 1000 // 29 seconds

export class WssServer {

  private server    : ws.Server
  private socketMap : Map<WssServerProvider, number>

  constructor(private refRc  : RunContextServer,
              private router : XmnRouterServer,
              httpsServer    : http.Server | https.Server) {

    this.socketMap = new Map()            
		this.server    = new ws.Server({
			server : httpsServer
		})

    this.server.on('connection', this.establishHandshake.bind(this))

    setInterval(this.cbTimerPing.bind(this), PING_FREQUENCY_MS)
	}
	
	private async establishHandshake(socket : WebSocket, req : http.IncomingMessage) {

    const rc = this.refRc.copyConstruct(undefined, 'handshake') as RunContextServer

    rc.isStatus() && rc.status(rc.getName(this), 'Recieved a new connection. Establishing handshake.')

    try {
      if(!req.url) throw new Error('Request URL absent.')

      const url          = urlModule.parse(req.url),
            path         = url.pathname || '',
            [host, port] = (req.headers.host || '').split(':')

      const [, version, clientId, encDataUri] = path.split(SLASH_SEP),
            encData                           = decodeURIComponent(encDataUri)

      if(!version || !clientId || !encData) throw new Error(`Invalid URL path ${path}.`)

      const isAppClient = ObopayWssClient.verifyClientRequest(rc, version, clientId),
            publicKey   = isAppClient ? undefined
                                      : ObopayWssClient.getClientPublicKey(clientId),
            encProvider = ObopayWssClient.getEncProvider(),
            body        = encProvider.decodeRequestUrl(encData, publicKey),
            diff        = Math.abs((Date.now() * 1000) - body.tsMicro), // ts difference in microseconds
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
      ci.msOffset       = diff > 5000000 ? diff : 0 // 5 seconds difference is negligible
      ci.lastEventTs    = 0
      ci.lastRequestTs  = body.tsMicro
      ci.customData     = wssConfig.custom

      const wssProvider = new WssServerProvider(rc, socket, ci, this.router, encProvider, wssConfig, this)
      si.provider       = wssProvider

      await this.router.verifyConnection(rc, ci, si)
      wssConfig.custom = ci.customData

      const woJson    = {type : WIRE_TYPE.SYS_EVENT, name : SYS_EVENT.WS_PROVIDER_CONFIG, data : wssConfig},
            respWo    = WireObject.getWireObject(woJson) as WireSysEvent,
            encConfig = await encProvider.encodeHandshakeMessage(respWo)

      rc.isDebug() && rc.debug(rc.getName(this), 'sending', respWo)
      socket.send(encConfig)

      this.markActive(wssProvider)
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), 'Error in establishing handshake.', err)
      socket.close()
    }
  }

  public markActive(wssProvider : WssServerProvider) {
    this.socketMap.set(wssProvider, Date.now() * 1000)
  }
  
  public markClosed(wssProvider : WssServerProvider) {
    this.socketMap.delete(wssProvider)
  }

  private cbTimerPing() {
    const notBefore      = Date.now() - PING_FREQUENCY_MS - 5000, /* extra time for network delays */
          notBeforeMicro = notBefore * 1000,
          rc             = this.refRc,
          len            = this.socketMap.size

    for(const [webSocket, lastTs] of this.socketMap) {

      if(lastTs < notBeforeMicro) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Cleaning up a connection as no ping or close.')
        webSocket.requestClose(rc)
      } else if(rc.isDebug() && len === 1) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Connection checked and found active.')
      }
    }
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

  public async send(rc : RunContextServer, woArr : Array<WireObject>) {
    const data = await this.encProvider.encodeBody(woArr)

    rc.isDebug() && rc.debug(rc.getName(this), 'sending', woArr)

    this.ci.lastRequestTs = woArr[woArr.length - 1].ts
    this.socket.send(data)
  }

  public requestClose(rc : RunContextServer) {
    this.socket.close()
    this.closeInternal(rc)
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

    rc.isDebug() && rc.debug(rc.getName(this), 'processing', woArr)

    // TODO : Verify requestTs
    // const tsVerified = woArr.every((wo : WireObject) => {
    //   return ObopayWssClient.verifyRequestTs(wo.ts, this.ci.lastRequestTs, this.wssConfig)
    // })

    // if(!tsVerified) {
    //   this.socket.close()
    //   this.closeInternal(rc)
    //   return
    // }

    this.wssServer.markActive(this)
    this.router.providerMessage(rc, this.ci, woArr)
  }

  private onClose() {
    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isDebug() && rc.debug(rc.getName(this), 'WebSocket onclose()')

    this.closeInternal(rc)
  }

  private onError(err : Error) {
    this.wssServer.markClosed(this)

    const rc = this.refRc.copyConstruct('', 'wss-request')
    rc.isError() && rc.error(rc.getName(this), 'WebSocket onerror()', err)
    this.router.providerFailed(rc, this.ci)
  }

  private closeInternal(rc : RunContextServer) {
    this.wssServer.markClosed(this)
    this.router.providerClosed(rc, this.ci)
  }
}