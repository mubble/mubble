/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { XmnRouter,
         MubbleWebSocket,
         ConnectionInfo,
         XmnError,
         WEB_SOCKET_URL,
         WireObject,
         ProtocolProvider }  from '@mubble/core'

import { XmnRouterBrowser

} from './xmn-router-browser'

import {  RunContextBrowser } from '../rc-browser'
import {  EncryptionBrowser } from './enc-provider-browser'         

export class WsBrowser extends ProtocolProvider {

  private ws: WebSocket
  private encProvider: EncryptionBrowser

  constructor(private rc : RunContextBrowser, 
              private ci : ConnectionInfo, 
              private router : XmnRouterBrowser) {
    super()
    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  private init(rc: RunContextBrowser, data: any): string {

    if (!this.encProvider) this.encProvider = new EncryptionBrowser(rc, this.ci)

    const url = `ws://${this.ci.host}${this.ci.port}/${
                this.ci.publicRequest ? WEB_SOCKET_URL.PUBLIC : WEB_SOCKET_URL.PRIVATE}`

    this.ws  = new WebSocket(url + `/${
      encodeURIComponent(btoa(this.encProvider.encodeHeader(rc)))}/${
      encodeURIComponent(btoa(data))
    }`)

    this.ws.onopen     = this.onOpen.bind(this)
    this.ws.onmessage  = this.onMessage.bind(this)
    this.ws.onclose    = this.onClose.bind(this)
    this.ws.onerror    = this.onError.bind(this)
    return null
  }

  send(rc: RunContextBrowser, data: WireObject): string {

    if (!this.ws) return this.init(rc, data)

    if (this.ws.readyState !== WebSocket.OPEN || this.ws.bufferedAmount) {
      rc.isStatus() && rc.status(rc.getName(this), 'Websocket is not ready right now', 
        {readyState: this.ws.readyState, bufferedAmount: this.ws.bufferedAmount})
      return XmnError._NotReady
    }

    this.encProvider.encodeBody(rc, data.stringify())
    this.ws.send(data)
    return null
  }

  onOpen() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onOpen()')
    this.router.providerReady()
  }

  onMessage(msgEvent: MessageEvent) {
    const data = msgEvent.data
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onMessage()', data.length)
    this.router.providerMessage(data)
  }

  onError(err: any) {
    this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 'Websocket onError()', err)
    this.cleanup()
    this.router.providerFailed()
  }

  onClose() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Websocket onClose()')
    this.cleanup()
    this.router.providerFailed()
  }

  private cleanup() {
    this.ws = null
    this.ci.provider = null
    this.encProvider = null
  }
}
