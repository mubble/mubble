/*------------------------------------------------------------------------------
   About      : Wss Client
   
   Created on : Mon Apr 15 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         WssProviderConfig,
         WireObject,
         WireRequest,
         Mubble,
         HTTP,
         WIRE_TYPE,
         SYS_EVENT,
         WireReqResp
       }                          from '@mubble/core'
import { 
         ObopayWssClient,
         HANDSHAKE
       }                          from './obopay-wss-client'
import { RunContextServer }       from '../rc-server'
import { WssEncProvider }         from './wss-enc-provider'
import { ServerCredentials }      from './credential-registry'
import * as ws                    from 'ws'
import * as lo                    from 'lodash'

const HANDSHAKE_ERROR = 'INVALID_HANDSHAKE_MESSAGE'

export class WssClient {

  private socket               : ws
  private encProvider          : WssEncProvider
  private ongoingRequests      : Array<WireRequest>
  private handshakeEstablished : boolean
  private sending              : boolean
  private openPromise          : Mubble.uPromise<boolean>
  private handshakePromise     : Mubble.uPromise<boolean>

  constructor(private refRc         : RunContextServer,
              private requestServer : ServerCredentials,
              private wssConfig     : WssProviderConfig,
              private selfId        : string,
              private unsecured    ?: boolean) {

    this.handshakeEstablished = false
    this.ongoingRequests      = []
    this.sending              = false
  }

  public async sendRequest(rc             : RunContextServer,
                           apiName        : string,
                           params         : Mubble.uObject<any>) {

    rc.isStatus() && rc.status(rc.getName(this), 'sendRequest', this.requestServer.id, apiName, params)
                    
    if (this.sending) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Another send in progress.')
      return
    }

    if (!this.socket && (this.socket != ws.OPEN || !this.handshakeEstablished)) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Handshake not established.', this.handshakeEstablished)

      this.establishHandshake(rc)
      this.openPromise      = new Mubble.uPromise()
      this.handshakePromise = new Mubble.uPromise()

      await Promise.all([this.openPromise.promise, this.handshakePromise.promise])
    }

    return new Promise((resolve, reject) => {
      const wr = new WireRequest(apiName, params, undefined, resolve, reject)
      this.ongoingRequests.push(wr)

      this.sendInternal(rc, [wr])
    })
  }

  public closeConnection(rc : RunContextServer) {
    rc.isStatus() && rc.status(rc.getName(this), 'Closing connection with', this.requestServer.id)

    this.socket.close()
    this.cleanUp(rc)
  }

  private async sendInternal(rc : RunContextServer, woArr : Array<WireObject>) {

    rc.isDebug() && rc.debug(rc.getName(this), 'sendInternal', woArr)

    this.sending = true

    const data = await this.encProvider.encodeBody(woArr, false)
    this.socket.send(data)

    this.sending = false
  }

  private establishHandshake(rc : RunContextServer) {

    rc.isStatus() && rc.status(rc.getName(this), `Establishing handshake with ${this.requestServer.id}.`)

    this.encProvider = ObopayWssClient.getEncProvider()

    const tsMicro     = Date.now() * 1000,
          encData     = this.encProvider.encodeRequestUrl(tsMicro, this.wssConfig, this.requestServer.syncHash),
          encDataUri  = encodeURIComponent(encData),
          urlPath     = `${this.unsecured ? 'ws' : 'wss'}://${this.requestServer.host}:${this.requestServer.port}/`
                        + `${HANDSHAKE}/${HTTP.CurrentProtocolVersion}/${this.selfId}/${encDataUri}`

    this.socket = new ws(urlPath)

    this.socket.onopen    = this.onOpen.bind(this)
    this.socket.onmessage = this.onMessage.bind(this)
    this.socket.onclose   = this.onClose.bind(this)
    this.socket.onerror   = this.onError.bind(this)
  }

  private onOpen() {
    const rc = this.refRc
    rc.isStatus() && rc.status(rc.getName(this), 'Connection open.')
    this.openPromise.resolve(true)
  }

  private async onMessage(msgEvent : any) {
    const rc   = this.refRc,
          data = Buffer.from(msgEvent.data)

    rc.isStatus() && rc.status(rc.getName(this), 'Message received.')

    if (!this.handshakeEstablished) {      // data is handshake reply
      rc.isDebug() && rc.debug(rc.getName(this), 'Treating message as handshake reply.')

      const wo = await this.encProvider.decodeHandshakeMessage(data)
      if (wo.type != WIRE_TYPE.SYS_EVENT || wo.name != SYS_EVENT.WS_PROVIDER_CONFIG) {
        rc.isError() && rc.error(rc.getName(this), 'Invalid handshake response.', wo)
        this.socket.close()
        throw new Mubble.uError(HANDSHAKE_ERROR, 'Invalid handshake message received ' + JSON.stringify(wo))
      }

      this.wssConfig            = wo.data as WssProviderConfig
      this.handshakeEstablished = true
      this.handshakePromise.resolve(true)
      return
    }

    // data is array of wire objects
    rc.isDebug() && rc.debug(rc.getName(this), 'Decrypting message.')

    const woArr = await this.encProvider.decodeBody(data, false)
    this.processMessage(rc, woArr)
  }

  private onClose() {
    const rc = this.refRc

    rc.isDebug() && rc.debug(rc.getName(this), 'Connection closed.')
    this.cleanUp(rc)
  }

  private onError(err : any) {
    const rc = this.refRc

    rc.isError() && rc.error(rc.getName(this), 'websocket error', err)
    this.cleanUp(rc)
  }

  private processMessage(rc : RunContextServer, woArr : Array<WireObject>) {

    rc.isDebug() && rc.debug(rc.getName(this), 'processMessage', woArr)
    
    for(const wo of woArr) {
      if (wo.type != WIRE_TYPE.REQ_RESP) {
        rc.isWarn() && rc.warn(rc.getName(this), 'Not implemented yet.', wo)
        continue
      }

      const resp = wo as WireReqResp
      const index = lo.findIndex(this.ongoingRequests, {ts : resp.ts})
      if (index === -1) {
        rc.isWarn() && rc.warn(rc.getName(this), 'Got response for not an ongoing request.', resp)
        continue
      }

      this.finishRequest(rc, index, resp.data, resp.errorCode, resp.errorMessage)
    }
  }

  private finishRequest(rc : RunContextServer, index : number,  data : Mubble.uObject<any>, errorCode ?: string | null, errorMessage ?: string | null) {

    const wr = this.ongoingRequests.splice(index, 1)[0]

    if (!wr.resolve) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Request already finished ???', wr, errorCode, errorMessage, data)
      return
    }

    if (errorCode && errorMessage) {
      rc.isError() && rc.error(rc.getName(this), 'Request failed', wr, errorCode, errorMessage)
      wr.reject(new Mubble.uError(errorCode, errorMessage))
    } else {
      rc.isStatus() && rc.status(rc.getName(this), 'Request succeeded', wr, data)
      wr.resolve(data)
    }

    wr.resolve = null
    wr.reject  = null
  }

  private cleanUp(rc : RunContextServer) {
    rc.isStatus() && rc.status(rc.getName(this), 'Cleaning up connection.')

    if(this.socket && this.socket.readyState === ws.OPEN) this.socket.close()

    this.socket               = null as any
    this.encProvider          = null as any
    this.wssConfig            = null as any
    this.handshakeEstablished = false
    this.ongoingRequests      = []
    this.sending              = false
  }
}