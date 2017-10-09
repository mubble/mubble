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
         TimerInstance,
         WireObject,
         Leader }  from '@mubble/core'

import { XmnRouterBrowser } from './xmn-router-browser'

import {  
  RunContextBrowser,
  LOG_LEVEL
} from '../rc-browser'

import {  EncryptionBrowser } from './enc-provider-browser'         

export class WsBrowser {

  private ws                : WebSocket
  private encProvider       : EncryptionBrowser
  private timerPing         : TimerInstance
  
  private socketCreateTs    : number = 0
  private lastMessageTs     : number = 0
  private msPingInterval    : number
  private sending           : boolean = false
  private configured        : boolean = false
  private preConfigQueue    : MessageEvent[] = []
  
  constructor(private rc : RunContextBrowser, 
              private ci : ConnectionInfo, 
              private router : XmnRouterBrowser) {

    rc.setupLogger(this, 'WsBrowser', LOG_LEVEL.DEBUG)
    this.timerPing       = rc.timer.register('ws-ping', this.cbTimerPing.bind(this))
    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  private uiArToB64(ar) {
    return btoa(String.fromCharCode(...ar))
  }

  send(rc: RunContextBrowser, data: WireObject): string | null {

    const ws = this.ws

    if ( this.sending || 
        (ws && (ws.readyState !== WebSocket.OPEN || !this.configured || ws.bufferedAmount)) ) {

      rc.isStatus() && rc.status(rc.getName(this), 'Websocket is not ready right now', {
        sending         : this.sending,
        configured      : this.configured, 
        readyState      : this.ws.readyState, 
        bufferedAmount  : this.ws.bufferedAmount
      })

      return XmnError._NotReady
    }

    this.sendInternal(rc, data)
    return null
  }

  private async sendInternal(rc: RunContextBrowser, data: WireObject) {

    this.sending = true

    if (!this.ws) {

      if (!this.encProvider) this.encProvider = new EncryptionBrowser(rc, this.ci, this.router.getSyncKey())
        
      const url     = `ws://${this.ci.host}:${this.ci.port}/${
                       this.ci.publicRequest ? WEB_SOCKET_URL.PUBLIC : WEB_SOCKET_URL.PRIVATE}`,
            header  = await this.encProvider.encodeHeader(rc),
            body    = await this.encProvider.encodeBody(rc, data)
        
      this.ws  = new WebSocket(url + `/${
        encodeURIComponent(this.uiArToB64(header))}/${
        encodeURIComponent(this.uiArToB64(body))
      }`)

      this.ws.binaryType = 'arraybuffer'
      
      this.ws.onopen     = this.onOpen.bind(this)
      this.ws.onmessage  = this.onMessage.bind(this)
      this.ws.onclose    = this.onClose.bind(this)
      this.ws.onerror    = this.onError.bind(this)
  
      this.socketCreateTs = Date.now()
        
    } else {
      const body = await this.encProvider.encodeBody(rc, data)
      this.ws.send(body)
    }
    
    this.setupTimer(rc)
    this.sending = false
  }

  onOpen() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onOpen() in', Date.now() - this.socketCreateTs, 'ms')
    this.router.providerReady()
  }

  async onMessage(msgEvent: MessageEvent) {

    const data = msgEvent.data

    if (!this.configured) {

      const ar      = new Uint8Array(data, 0, 1),
            leader  = String.fromCharCode(ar[0])

      if (leader !== Leader.CONFIG) {
        this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Queued message length:', data.byteLength)
        this.preConfigQueue.push(msgEvent)
        return
      }
    }
    const messages = await this.encProvider.decodeBody(this.rc, data)
    this.router.providerMessage(this.rc, messages)
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

  async processSysEvent(rc: RunContextBrowser, se: WireSysEvent) {

    if (se.name === SYS_EVENT.WS_PROVIDER_CONFIG) {

      const config: WebSocketConfig = se.data as WebSocketConfig
      this.msPingInterval = config.msPingInterval
      await this.encProvider.setNewKey(config.syncKey)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'First message in', Date.now() - this.socketCreateTs, 'ms')

      this.configured = true
      while (this.preConfigQueue.length) {
        const message = this.preConfigQueue.shift()
        this.onMessage(message)
      }
    }
  }

  setupTimer(rc: RunContextBrowser) {
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'setupTimer')
    this.lastMessageTs = Date.now()
    this.timerPing.tickAfter(this.msPingInterval)
  }

  cbTimerPing(): number {

    if (!this.ci.provider) return 0

    const now   = Date.now(),
          diff  = this.lastMessageTs + this.msPingInterval - now

    if (diff <= 0) {
      // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Sending ping')
      this.send(this.rc, new WireSysEvent(SYS_EVENT.PING, {}))
      return this.msPingInterval
    } else {
      // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'diff case', {diff, now, 
      //   lastMessageTs: this.lastMessageTs, msPingInterval: this.msPingInterval})
      return diff
    }
  }

  private cleanup() {
    if (this.ci.provider) {

      this.timerPing.remove()

      this.ci.provider  = null
      this.ws           = null as any
      this.encProvider  = null as any
    }
  }
}
