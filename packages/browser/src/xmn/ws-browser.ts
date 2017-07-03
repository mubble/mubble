/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { ConnectionInfo,
         XmnError,
         WEB_SOCKET_URL,
         SYS_EVENT,
         WireSysEvent,
         WebSocketConfig,
         WireObject }  from '@mubble/core'

import { XmnRouterBrowser } from './xmn-router-browser'

import {  RunContextBrowser } from '../rc-browser'
import {  EncryptionBrowser } from './enc-provider-browser'         

export class WsBrowser {

  private ws: WebSocket
  private encProvider: EncryptionBrowser
  private lastMessageTime: number = 0
  private msPingInterval: number  = 30000
  private cbTimer: any

  constructor(private rc : RunContextBrowser, 
              private ci : ConnectionInfo, 
              private router : XmnRouterBrowser) {
    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  private init(rc: RunContextBrowser, data: WireObject): string {

    if (!this.encProvider) this.encProvider = new EncryptionBrowser(rc, this.ci)

    const url = `ws://${this.ci.host}:${this.ci.port}/${
                this.ci.publicRequest ? WEB_SOCKET_URL.PUBLIC : WEB_SOCKET_URL.PRIVATE}`

    this.ws  = new WebSocket(url + `/${
      encodeURIComponent(btoa(this.encProvider.encodeHeader(rc)))}/${
      encodeURIComponent(btoa(this.encProvider.encodeBody(rc, data)))
    }`)

    this.ws.onopen     = this.onOpen.bind(this)
    this.ws.onmessage  = this.onMessage.bind(this)
    this.ws.onclose    = this.onClose.bind(this)
    this.ws.onerror    = this.onError.bind(this)

    this.cbTimer       = this.timerEvent.bind(this)
    this.setupTimer(rc)
    return null
  }

  send(rc: RunContextBrowser, data: WireObject): string {

    if (!this.ws) return this.init(rc, data)

    if (this.ws.readyState !== WebSocket.OPEN || this.ws.bufferedAmount) {
      rc.isStatus() && rc.status(rc.getName(this), 'Websocket is not ready right now', 
        {readyState: this.ws.readyState, bufferedAmount: this.ws.bufferedAmount})
      return XmnError._NotReady
    }
    
    this.ws.send(this.encProvider.encodeBody(rc, data))
    this.setupTimer(rc)
    return null
  }

  onOpen() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onOpen()')
    this.router.providerReady()
  }

  onMessage(msgEvent: MessageEvent) {
    const data = msgEvent.data
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onMessage() length:', data.length)
    this.router.providerMessage(this.rc, this.encProvider.decodeBody(this.rc, data))
  }

  onError(err: any) {
    this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 'Websocket onError()', err)
    if (this.ci.provider) {
      this.cleanup()
      this.router.providerFailed()
    }
  }

  onClose() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onClose()')
    if (this.ci.provider) {
      this.cleanup()
      this.router.providerFailed()
    }
  }

  processSysEvent(rc: RunContextBrowser, se: WireSysEvent) {

    if (se.name === SYS_EVENT.WS_PROVIDER_CONFIG) {
      const config: WebSocketConfig = se.data as WebSocketConfig
      this.msPingInterval = config.msPingInterval
      this.setupTimer(rc)
      return true
    } else {
      return false
    }
  }

  setupTimer(rc: RunContextBrowser) {
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'setupTimer')
    this.lastMessageTime = Date.now()
    rc.timer.tickAfter('ws-ping', this.cbTimer, this.msPingInterval)
  }

  timerEvent(): number {

    if (!this.ci.provider) return 0

    const now   = Date.now(),
          diff  = this.lastMessageTime + this.msPingInterval - now

    if (diff <= 0) {
      // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Sending ping')
      this.send(this.rc, new WireSysEvent(SYS_EVENT.PING, {}))
      return this.msPingInterval
    } else {
      // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'diff case', {diff, now, 
      //   lastMessageTime: this.lastMessageTime, msPingInterval: this.msPingInterval})
      return diff
    }
  }

  private cleanup() {
    if (this.ci.provider) {
      this.rc.timer.remove(this.cbTimer)
      this.ws = null
      this.ci.provider = null
      this.encProvider = null
    }
  }
}
