/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  RunContextBrowser } from '../rc-browser'

import {  ConnectionInfo,
          Protocol,
          XmnError,
          WIRE_TYPE,
          WireEvent,
          WireEventResp,
          WireObject,
          WireReqResp,
          WireRequest,
          WireSysEvent,
          ClientIdentity,
          SYS_EVENT,
          NetworkType       } from '@mubble/core'

import {  WsBrowser }         from './ws-browser'      
import * as lo                from 'lodash'

const TIMEOUT_MS    = 55000,
      SEND_RETRY_MS = 1000,
      SEND_TIMEOUT  = 10000

export abstract class XmnRouterBrowser {

  private ci      : ConnectionInfo
  private ongoing : WireRequest[] = []
  private cbSendTimer
  private cbTimeoutTimer

  constructor(private rc: RunContextBrowser, serverUrl: string) {

    const urlParser = document.createElement('a')
    urlParser.href  = serverUrl

    this.ci                = {} as ConnectionInfo
    this.ci.protocol       = Protocol.WEBSOCKET
    this.ci.host           = urlParser.hostname
    this.ci.port           = Number(urlParser.port) || 80

    this.cbSendTimer       = this.tickTrySend.bind(this)
    this.cbTimeoutTimer    = this.tickCheckTimeout.bind(this)

    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  init(clientIdentity: ClientIdentity) {
    this.ci.publicRequest  = !clientIdentity
    this.ci.clientIdentity = clientIdentity
  }

  setConnectionAttr(netType, location) {
    this.ci.networkType = netType
    this.ci.location = JSON.stringify(location)
  }

  abstract upgradeClientIdentity(rc: RunContextBrowser, clientIdentity: ClientIdentity)

  async sendRequest(rc: RunContextBrowser, apiName: string, data: object): Promise<object> {

    return new Promise((resolve, reject) => {

      const wr = new WireRequest(apiName, data, 0, resolve, reject)
      this.ongoing.push(wr)

      if (!this.ci.provider) this.ci.provider = new WsBrowser(rc, this.ci, this)

      if (!this.ci.provider.send(rc, wr)) {
        wr._isSent = true
        rc.isDebug() && rc.debug(rc.getName(this), 'sent request', wr)
        rc.timer.tickAfter('router-timeout', this.cbTimeoutTimer, TIMEOUT_MS)
      } else {
        rc.isStatus() && rc.status(rc.getName(this), 'send to be retried', wr)
        rc.timer.tickAfter('router-sender', this.cbSendTimer, SEND_RETRY_MS)
      }
    })
  }

  sendEvent(rc: RunContextBrowser, eventName: string, data: object): void {

    const event = new WireEvent(eventName, data)

    // save to disk
    // add to pending (without data)
    // don't do a send unless pending size is 0

    if (!this.ci.provider) this.ci.provider = new WsBrowser(rc, this.ci, this)

    rc.isDebug() && rc.debug(rc.getName(this), 'sendEvent', event)
    this.ci.provider.send(rc, event)
  }

  providerReady() {
    this.tickTrySend()
  }

  providerFailed() {

    for (var index = 0; index < this.ongoing.length; index++) {
      var wr = this.ongoing[index];
      this.finishRequest(this.rc, index, XmnError.ConnectionFailed)
    }
    this.ongoing = []
  }

  providerMessage(rc: RunContextBrowser, arData: WireObject[]) {

    for (const wo of arData) {

      rc.isDebug() && rc.debug(rc.getName(this), 'providerMessage', wo)

      switch (wo.type) {

        case WIRE_TYPE.REQUEST:
        case WIRE_TYPE.EVENT:
          this.rc.isError() && this.rc.error(this.rc.getName(this), 'Not implemented', wo)

        case WIRE_TYPE.EVENT_RESP:
          // TODO:
          break

        case WIRE_TYPE.REQ_RESP:
          const resp = wo as WireReqResp

          const index = lo.findIndex(this.ongoing, {ts: resp.ts})
          if (index === -1) {
            this.rc.isStatus() && this.rc.status(this.rc.getName(this), 
              'Got response for request that is not in progress... timed-out?', 
              resp.name, 'sent at', new Date(resp.ts))
            return
          }

          this.finishRequest(this.rc, index, resp.error, resp.data)
          break

        case WIRE_TYPE.SYS_EVENT:
          this.processSysEvent(this.rc, wo) || this.ci.provider.processSysEvent(this.rc, wo)
          break

        default:
          this.rc.isError() && this.rc.error(this.rc.getName(this), 'Unknown message', wo)
      }
    }
  }

  private processSysEvent(rc: RunContextBrowser, se: WireSysEvent) {
    if (se.name === SYS_EVENT.UPGRADE_CLIENT_IDENTITY) {
      this.upgradeClientIdentity(rc, se.data as ClientIdentity)
      return true
    } else {
      return false
    }
  }

  private tickTrySend(): number {

    const wr = this.ongoing.find((wr, index) => !wr._isSent)
    if (!wr) return 0

    if (!this.ci.provider.send(this.rc, wr)) {

      wr._isSent = true
      this.rc.timer.tickAfter('router-timeout', this.cbTimeoutTimer, TIMEOUT_MS)

    } else if ((Date.now() - wr.ts) > SEND_TIMEOUT) {

      this.finishRequest(this.rc, this.ongoing.indexOf(wr), XmnError.SendTimedOut)

    } else {
      return SEND_RETRY_MS
    }

    // We need to see if there are still messages left to be sent
    return this.ongoing.find((wr, index) => !wr._isSent) ? SEND_RETRY_MS : 0
  }

  private tickCheckTimeout(): number {

    const now = Date.now()
    let nextTimeout = Number.MAX_SAFE_INTEGER

    for (let index = 0; index < this.ongoing.length; index++) {

      const wr        = this.ongoing[index],
            timeoutAt = wr.ts + TIMEOUT_MS

      if (wr._isSent) {
        if (now >= timeoutAt) {
          this.finishRequest(this.rc, index--, XmnError.RequestTimedOut)
        } else {
          if (nextTimeout > timeoutAt) nextTimeout = timeoutAt
        }
      }
    }
    return nextTimeout === Number.MAX_SAFE_INTEGER ? 0 : nextTimeout - now
  }

  private finishRequest(rc: RunContextBrowser, index: number, errorCode: string, data ?: object) {

    const wr = this.ongoing[index]
    this.ongoing.splice(index, 1)

    if (!wr.resolve) {

      rc.isStatus() && rc.status(rc.getName(this), 'Trying to finish already finished request', errorCode,
        wr.name, 'created at', new Date(wr.ts))

      return  
    }

    if (errorCode) {

      rc.isStatus() && rc.status(rc.getName(this), 'Request failed with code', errorCode,
        wr.name, 'created at', new Date(wr.ts))
      
      wr.reject(new Error(errorCode))

    } else {

      rc.isStatus() && rc.status(rc.getName(this), 'Request succeeded', 
        wr.name, 'created at', new Date(wr.ts))

      wr.resolve(data)  
    }

    wr.reject  = null
    wr.resolve = null
  }

} // end of class
