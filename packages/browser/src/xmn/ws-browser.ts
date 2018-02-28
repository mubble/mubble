/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.

  Ping: Ping indicates to the server that client is up and kicking.... 
  Websocket carries ephemeral events too. Design of Ping also helps in carrying 
  ephemeral events. This is the reason we don't tick timer when we receive 
  messages from the server

------------------------------------------------------------------------------*/

import { ConnectionInfo,
         XmnError,
         WEB_SOCKET_URL,
         SYS_EVENT,
         WireEvent,
         WireEphEvent,
         WireSysEvent,
         WebSocketConfig,
         ConnectionError,
         TimerInstance,
         WireObject,
         Leader,
         XmnProvider}  from '@mubble/core'

import { XmnRouterBrowser } from './xmn-router-browser'

import {  
  RunContextBrowser,
  LOG_LEVEL
} from '../rc-browser'

import {  EncryptionBrowser } from './enc-provider-browser'         

export class WsBrowser implements XmnProvider{

  private ws                : WebSocket
  private encProvider       : EncryptionBrowser
  private timerPing         : TimerInstance
  
  private socketCreateTs    : number = 0
  private lastMessageTs     : number = 0
  private msPingInterval    : number = 29000 // Must be a valid number
  private sending           : boolean = false
  private configured        : boolean = false
  private preConfigQueue    : MessageEvent[] = []

  private ephemeralEvents   : WireEvent[] = []
  
  constructor(private rc : RunContextBrowser, 
              private ci : ConnectionInfo, 
              private router : XmnRouterBrowser) {

    rc.setupLogger(this, 'WsBrowser')
    this.timerPing       = rc.timer.register('ws-ping', this.cbTimerPing.bind(this))
    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  private uiArToB64(ar) {
    return btoa(String.fromCharCode(...ar))
  }

  public sendEphemeralEvent(event: WireEphEvent) {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.ci.provider)

    if (this.ephemeralEvents.length >= 20) {
      this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 'Too many ephemeralEvents. Sizing to 20')
      while (this.ephemeralEvents.length >= 20) this.ephemeralEvents.shift()
    }
    this.ephemeralEvents.push(event)
  }

  public send(rc: RunContextBrowser, data: WireObject[] | WireObject): string | null {

    const ws = this.ws

    if ( this.sending || 
        (ws && (ws.readyState !== WebSocket.OPEN || !this.configured || ws.bufferedAmount)) ) {

      rc.isStatus() && rc.status(rc.getName(this), 'Websocket is not ready right now', {
        anotherSendInProgress : this.sending,
        configured            : this.configured,
        readyState            : this.ws ? this.ws.readyState : 'to be created',
        bufferedAmount        : this.ws.bufferedAmount
      })

      return XmnError._NotReady
    }

    const objects: WireObject[] = Array.isArray(data) ? data : [data] 

    if (this.ephemeralEvents.length) {
      objects.push(...this.ephemeralEvents)
      this.ephemeralEvents.length = 0
    }
    this.sendInternal(rc, objects)
    return null
  }

  private async sendInternal(rc: RunContextBrowser, data: WireObject[]) {

    let messageBody
    this.sending = true

    if (!this.ws) {

      if (!this.encProvider) this.encProvider = new EncryptionBrowser(rc, this.ci, this.router.getSyncKey())
        
      const url     = `${this.ci.port === 443 ? 'wss' : 'ws'}://${this.ci.host}:${this.ci.port}/${
                       this.ci.publicRequest ? WEB_SOCKET_URL.PUBLIC : WEB_SOCKET_URL.PRIVATE}/`,
            header  = await this.encProvider.encodeHeader(rc),
            body    = await this.encProvider.encodeBody(rc, data)

      messageBody = encodeURIComponent(this.uiArToB64(header)) + '/' + 
                    encodeURIComponent(this.uiArToB64(body))
        
      this.ws  = new WebSocket(url + messageBody)
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Opened socket with url', url)
  
      this.ws.binaryType = 'arraybuffer'
      
      this.ws.onopen     = this.onOpen.bind(this)
      this.ws.onmessage  = this.onMessage.bind(this)
      this.ws.onclose    = this.onClose.bind(this)
      this.ws.onerror    = this.onError.bind(this)
  
      this.socketCreateTs = Date.now()
        
    } else {
      messageBody = await this.encProvider.encodeBody(rc, data)
      this.ws.send(messageBody)
    }
    
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Sent message', {msgLen: messageBody.length, 
      messages: data.length, firstMsg: data[0].name})

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
    await this.router.providerMessage(this.rc, messages)
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

      const config: WebSocketConfig = se.data as WebSocketConfig,
            msPing = config.msPingInterval

      this.msPingInterval = msPing
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
                            msPing && Number.isInteger(msPing), msPing)
      
      await this.encProvider.setNewKey(config.syncKey)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'First message in', Date.now() - this.socketCreateTs, 'ms')

      this.configured = true
      while (this.preConfigQueue.length) {
        const message = this.preConfigQueue.shift()
        await this.onMessage(message)
      }
    } else if (se.name === SYS_EVENT.ERROR) {

      const errMsg = se.data as ConnectionError
      rc.isWarn() && rc.warn(rc.getName(this), 'processSysEvent' , errMsg)
      if (this.ci.provider) {
        this.cleanup()
        this.router.providerFailed(errMsg.code)
      }
    }
  }

  setupTimer(rc: RunContextBrowser) {
    this.lastMessageTs = Date.now()
    this.timerPing.tickAfter(this.msPingInterval, true)
  }

  cbTimerPing(): number {

    if (!this.ci.provider) return 0

    const now   = Date.now(),
          diff  = this.lastMessageTs + this.msPingInterval - now

    if (diff <= 0) {
      this.send(this.rc, [new WireSysEvent(SYS_EVENT.PING, {})])
      return this.msPingInterval
    } else {
      return diff
    }
  }

  private cleanup() {

    if (!this.ci.provider) return

    try {
      this.timerPing.remove()
      
      this.encProvider  = null as any
      this.ci.provider  = null

      if (this.ws) this.ws.close()
      this.ws           = null as any
  
    } catch (e) {}
  }
}
