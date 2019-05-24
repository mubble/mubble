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

import { 
         ConnectionInfo,
         XmnError,
         SYS_EVENT,
         WireEvent,
         WireEphEvent,
         WireSysEvent,
         ConnectionError,
         TimerInstance,
         WireObject,
         XmnProvider,
         WssProviderConfig,
         HANDSHAKE,
         WIRE_TYPE,
         WireRequest
       }                                from '@mubble/core'
import { XmnRouterBrowser }             from './xmn-router-browser'
import { RunContextBrowser }            from '../rc-browser'
import { EncryptionBrowser }            from './enc-provider-browser'

const PING_SECS             = 29,
      TOLERANCE_SECS        = 5,
      RFRSH_LAST_REQ_SECS   = 60

export class WsBrowser implements XmnProvider {

  private ws                  : WebSocket
  private encProvider         : EncryptionBrowser
  private timerPing           : TimerInstance
  private lastRequestTimer    : TimerInstance
  private wsProviderConfig    : WssProviderConfig
  private pendingMessage      : WireObject[] | WireObject
  
  private socketCreateTs      : number          = 0
  private lastMessageTs       : number          = 0
  private sending             : boolean         = false
  private configured          : boolean         = false
  private connExpired         : boolean         = false
  private lastRequestTs       : number          = 0

  private ephemeralEvents     : WireEvent[]     = []
  private sessionTimedoutSecs : number    

  constructor(private rc     : RunContextBrowser, 
              private ci     : ConnectionInfo,
              private router : XmnRouterBrowser) {

    rc.setupLogger(this, 'WsBrowser')
    this.timerPing        = rc.timer.register('ws-ping', this.cbTimerPing.bind(this))
    this.lastRequestTimer = rc.timer.register('ws-request', this.cbRequestTimer.bind(this))

    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')

  }

  private uiArToB64(ar : any) {
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

  public requestClose() {
    const ws  = this.ws
    if(ws && ws.readyState !== WebSocket.CLOSED)
      ws.close()
  }

  private async sendInternal(rc: RunContextBrowser, data: WireObject[]) {

    let messageBody
    this.sending = true

    if (!this.ws) {

      this.pendingMessage = data

      if (!this.encProvider) {
        this.encProvider = new EncryptionBrowser(rc, this.ci, this.router.getPubKey())
        await this.encProvider.init()
      }

      if (!this.wsProviderConfig) {
        this.wsProviderConfig = {
          pingSecs        : PING_SECS,
          maxOpenSecs     : this.router.getMaxOpenSecs(),
          toleranceSecs   : TOLERANCE_SECS,
          key             : await this.encProvider.getSyncKeyB64(),
          custom          : this.ci.customData
        }
      }

      const url     = `${this.ci.port === 443 ? 'wss' : 'ws'}://${this.ci.host}:${this.ci.port}/${HANDSHAKE}/${this.ci.protocolVersion}/${this.ci.shortName}/`,
            header  = await this.encProvider.encodeHeader(this.wsProviderConfig)
      
      messageBody = encodeURIComponent(header)

      this.ws  = new WebSocket(url + messageBody)
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Opened socket with url', url + messageBody)
  
      this.ws.binaryType = 'arraybuffer'
      
      this.ws.onopen     = this.onOpen.bind(this)
      this.ws.onmessage  = this.onMessage.bind(this)
      this.ws.onclose    = this.onClose.bind(this)
      this.ws.onerror    = this.onError.bind(this)
  
      this.socketCreateTs = Date.now()
        
    } else {
      
      if (!this.isConnWithinPing(Date.now())) { // Connection expired
        rc.isDebug() && rc.debug(rc.getName(this), `Connection expired..requesting Socket close.`)
        this.sending      = false
        this.connExpired  = true
        this.requestClose()
        return
      }
      
      messageBody = await this.encProvider.encodeBody(data)
      this.ws.send(messageBody)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Sent message', {msgLen: messageBody.length, 
        messages: data.length, firstMsg: data[0].name})  
    }

    const wireObjIsOfReq  = data.some(wireObject => { return wireObject.type === WIRE_TYPE.REQUEST })

    if (wireObjIsOfReq && this.router.canStrtLastReqTimer(this.rc)) {
      this.setLastReqTimer(rc)
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
    const messages = await this.encProvider.decodeBody(data)
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
      this.router.providerFailed(this.connExpired ? XmnError._ConnectionExpired : null)
    }
  }

  async processSysEvent(rc: RunContextBrowser, se: WireSysEvent) {

    if (se.name === SYS_EVENT.WS_PROVIDER_CONFIG) {

      const config: WssProviderConfig = se.data as WssProviderConfig,
            msPingSecs = config.pingSecs      

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
          msPingSecs && Number.isInteger(msPingSecs), msPingSecs)

      Object.assign(this.wsProviderConfig, config)
      
      if (config.key) await this.encProvider.setNewKey(config.key)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'First message in', Date.now() - this.socketCreateTs, 'ms')

      this.configured = true
      
      if (this.pendingMessage) {
        this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `Sending Pending Message...`)
        await this.send(this.rc, this.pendingMessage)
        this.pendingMessage = null
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

  private isConnWithinPing(requestTs: number) {

    const wsConfig = this.wsProviderConfig,
          pingTh   = this.lastMessageTs  + (wsConfig.pingSecs + wsConfig.toleranceSecs)    * 1000,
          openTh   = this.socketCreateTs + (wsConfig.maxOpenSecs - wsConfig.toleranceSecs) * 1000

    return requestTs < pingTh && requestTs < openTh
  }

  private async setLastReqTimer(rc: RunContextBrowser) {

    this.lastRequestTs  = Date.now()
    this.lastRequestTimer.tickAfter(RFRSH_LAST_REQ_SECS * 1000, true)


    if (!this.sessionTimedoutSecs) {
      this.sessionTimedoutSecs  = await this.router.getSessionTimeOutSecs(rc)
    }

  }

  private setupTimer(rc: RunContextBrowser) {
    
    this.lastMessageTs = Date.now()
    this.timerPing.tickAfter(this.wsProviderConfig.pingSecs * 1000, true)
  }

  private cbRequestTimer() {

    if (!this.ci.provider) return 0

    const now   = Date.now(),
          diff  = now - this.lastRequestTs

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `cbRequestTimer ${diff}, ${this.sessionTimedoutSecs}`)

    if (diff >= (this.sessionTimedoutSecs * 1000)) {
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), `Session timed out. Closing session`)
      this.router.sessionTimedOut(this.rc)
      this.requestClose()
      return RFRSH_LAST_REQ_SECS * 1000
    }

    return diff
  }

  private cbTimerPing(): number {

    if (!this.ci.provider) return 0

    const now   = Date.now(),
          diff  = this.lastMessageTs + this.wsProviderConfig.pingSecs * 1000 - now

    if (diff <= 0) {
      this.send(this.rc, [new WireSysEvent(SYS_EVENT.PING, {})])
      return this.wsProviderConfig.pingSecs * 1000
    }

    return diff
    
  }

  private cleanup() {

    if (!this.ci.provider) return

    try {
      this.timerPing.remove()
      this.lastRequestTimer.remove()
      
      this.encProvider  = null as any
      this.ci.provider  = null as any

      if (this.ws) this.ws.close()
      this.ws           = null as any
  
    } catch (e) {}
  }
}
