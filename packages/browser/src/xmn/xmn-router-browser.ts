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
          TimerInstance,
          SYS_EVENT,
          NetworkType       } from '@mubble/core'

import {  WsBrowser }         from './ws-browser'      
import * as lo                from 'lodash'
import Dexie                  from 'dexie'

const TIMEOUT_MS    = 55000,
      SEND_RETRY_MS = 1000,
      SEND_TIMEOUT  = 10000

export abstract class XmnRouterBrowser {

  private ci              : ConnectionInfo
  private ongoingRequests : WireRequest[] = []
  
  private timerReqResend: TimerInstance
  private timerReqTimeout: TimerInstance
  private timerEventTimeout: TimerInstance

  private db: XmnDb

  // This flag indicates that events can be sent. This is to allow application to
  // have control when events are being sent. Normally, events are sent after 
  // getting client identity or login. But in background runs, events can be sent 
  // immediately

  private sendEventPermitted = false
  private lastSentEventTs    = 0

  constructor(private rc: RunContextBrowser, serverUrl: string) {

    const urlParser = document.createElement('a')
    urlParser.href  = serverUrl

    this.ci             = {} as ConnectionInfo
    this.ci.protocol    = Protocol.WEBSOCKET
    this.ci.host        = urlParser.hostname
    this.ci.port        = Number(urlParser.port) || 80

    this.timerReqResend    = rc.timer.register('router-resend', this.cbTimerReqResend.bind(this))
    this.timerReqTimeout   = rc.timer.register('router-req-timeout', this.cbTimerReqTimeout.bind(this))
    this.timerEventTimeout = rc.timer.register('router-event-timeout', this.cbTimerEventTimeout.bind(this))

    rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  async init(clientIdentity: ClientIdentity, netType: string, location: string) {
    this.ci.publicRequest   = !clientIdentity
    this.ci.clientIdentity  = clientIdentity
    this.ci.networkType     = netType
    this.ci.location        = JSON.stringify(location)
    this.db                 = new XmnDb()
    await EventTable.removeOldByTs(this.rc, this.db, Date.now() - 7 * 24 * 3600000 /* 7 days */)
  }

  setConnectionAttr(netType: string, location: string) {

    console.log(`Came to setConnectionAttr ${netType} ${location}`)

    this.ci.networkType            = netType
    if (location) this.ci.location = JSON.stringify(location)
    this.trySendingEvents(this.rc)
  }

  sendPendingEvents() {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), !this.ci.publicRequest)

    this.sendEventPermitted = true
    this.trySendingEvents(this.rc)
  }

  abstract upgradeClientIdentity(rc: RunContextBrowser, clientIdentity: ClientIdentity): void

  async sendRequest(rc: RunContextBrowser, apiName: string, data: object): Promise<object> {

    return new Promise((resolve, reject) => {

      const wr = new WireRequest(apiName, data, 0, resolve, reject)
      this.ongoingRequests.push(wr)

      if (!this.ci.provider) this.ci.provider = new WsBrowser(rc, this.ci, this)

      if (!this.ci.provider.send(rc, wr)) {
        wr._isSent = true
        rc.isDebug() && rc.debug(rc.getName(this), 'sent request', wr)
        this.timerReqTimeout.tickAfter(TIMEOUT_MS)
      } else {
        rc.isStatus() && rc.status(rc.getName(this), 'send to be retried', wr)
        this.timerReqResend.tickAfter(SEND_RETRY_MS)
      }
    })
  }

  async sendEvent(rc: RunContextBrowser, eventName: string, data: object) {

    rc.isAssert() && rc.assert(rc.getName(this), !this.ci.publicRequest)
    if (!this.sendEventPermitted) this.sendEventPermitted = true

    const event = new WireEvent(eventName, data)

    const eventTable = new EventTable(event)
    await eventTable.save(this.db)
    await this.trySendingEvents(rc)
  }

  async trySendingEvents(rc: RunContextBrowser) {

    if (!this.sendEventPermitted || !this.ci.clientIdentity || 
        !this.ci.networkType || this.lastSentEventTs) {

      rc.isDebug() && rc.debug(rc.getName(this), 'Skipping sending event as not ready', {
        sendEventPermitted  : this.sendEventPermitted,
        networkType         : this.ci.networkType,
        lastSentEventTs     : this.lastSentEventTs
      })
      return
    }

    const arEvent = await EventTable.getOldEvents(rc, this.db)
    if (!arEvent.length) {
      this.timerEventTimeout.remove()
      return
    }

    for (let index = 0; index < arEvent.length; index++) {

      if (!this.ci.provider) this.ci.provider = new WsBrowser(rc, this.ci, this)
      
      const eventTable = arEvent[index],
            wireEvent  = new WireEvent(eventTable.name, JSON.parse(eventTable.data), eventTable.ts)

      if (this.ci.provider.send(rc, wireEvent)) break // failed to send

      rc.isDebug() && rc.debug(rc.getName(this), 'sent event', wireEvent)
      this.lastSentEventTs = wireEvent.ts
      this.timerEventTimeout.tickAfter(TIMEOUT_MS, true)
    }
  }

  providerReady() {
    this.cbTimerReqResend()
  }

  providerFailed() {

    for (let index = 0; index < this.ongoingRequests.length; index++) {
      const wr = this.ongoingRequests[index];
      this.finishRequest(this.rc, index, XmnError.ConnectionFailed)
    }
    this.ongoingRequests = []
    this.lastSentEventTs = 0
  }

  async providerMessage(rc: RunContextBrowser, arData: WireObject[]) {

    for (const wo of arData) {

      rc.isDebug() && rc.debug(rc.getName(this), 'providerMessage', wo)

      switch (wo.type) {

        case WIRE_TYPE.REQUEST:
        case WIRE_TYPE.EVENT:
          this.rc.isError() && this.rc.error(this.rc.getName(this), 'Not implemented', wo)
          break

        case WIRE_TYPE.EVENT_RESP:
          const eventResp = wo as WireEventResp
          rc.isAssert() && rc.assert(rc.getName(this), eventResp.ts)

          await EventTable.removeOldByTs(rc, this.db, eventResp.ts)
          if (this.lastSentEventTs === eventResp.ts) {
            this.lastSentEventTs = 0
            await this.trySendingEvents(rc)
          }
          break

        case WIRE_TYPE.REQ_RESP:
          const resp = wo as WireReqResp

          const index = lo.findIndex(this.ongoingRequests, {ts: resp.ts})
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

  private cbTimerReqResend(): number {

    const wr = this.ongoingRequests.find(wr => !wr._isSent)
    if (!wr) return 0

    if (!this.ci.provider.send(this.rc, wr)) {

      wr._isSent = true
      this.timerReqTimeout.tickAfter(TIMEOUT_MS)

    } else if ((Date.now() - wr.ts) > SEND_TIMEOUT) {

      this.finishRequest(this.rc, this.ongoingRequests.indexOf(wr), XmnError.SendTimedOut)

    } else {
      return SEND_RETRY_MS
    }

    // We need to see if there are still messages left to be sent
    return this.ongoingRequests.find(wr => !wr._isSent) ? SEND_RETRY_MS : 0
  }

  private cbTimerReqTimeout(): number {

    const now = Date.now()
    let nextTimeout = Number.MAX_SAFE_INTEGER

    for (let index = 0; index < this.ongoingRequests.length; index++) {

      const wr        = this.ongoingRequests[index],
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

  private cbTimerEventTimeout(): number {

    const diff = this.lastSentEventTs + TIMEOUT_MS - Date.now()
    if (diff > 0) return diff

    this.lastSentEventTs = 0
    this.trySendingEvents(this.rc)
    return TIMEOUT_MS
  }

  private finishRequest(rc: RunContextBrowser, index: number, errorCode: string | null, data ?: object) {

    const wr = this.ongoingRequests[index]
    this.ongoingRequests.splice(index, 1)

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

class EventTable {

  static async getOldEvents(rc: RunContextBrowser, db: XmnDb): Promise<EventTable[]> {
    const ar = await db.events.orderBy('ts').limit(5).toArray(),
          arEt = ar.map(item => {
            const et = new EventTable()
            et.ts   = item.ts
            et.name = item.name
            et.data = item.data
            return et
          })
    rc.isDebug() && rc.debug(rc.getName(this), 'Retrieved events from db, count:', arEt.length)
    return arEt      
  }

  static async removeOldByTs(rc: RunContextBrowser, db: XmnDb, ts: number) {
    
    await db.transaction('rw', db.events, async() => {
      await db.events.where('ts').belowOrEqual(ts).delete()
    })
    rc.isDebug() && rc.debug(rc.getName(this), 'Deleted events from db with ts belowOrEqual:', ts)
  }

  ts    : number
  name  : string
  data  : string

  constructor(event ?: WireEvent) {
    if (!event) return
    this.ts = event.ts
    this.name = event.name
    this.data = JSON.stringify(event.data)
  }

  async save(db: XmnDb) {
    await db.transaction('rw', db.events, async() => {
      await db.events.put(this)
    })
  }

}

class XmnDb extends Dexie {

  events: Dexie.Table<EventTable, number>
  constructor () {
    super('xmn')
    this.version(1).stores({
      events: 'ts'
    })
    this.events.mapToClass(EventTable)
  }
}

