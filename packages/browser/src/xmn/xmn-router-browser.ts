/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'
import Dexie                  from 'dexie'

import {  RunContextBrowser } from '../rc-browser'

import {  Mubble,
          ConnectionInfo,
          Protocol,
          XmnError,
          WIRE_TYPE,
          WireEvent,
          WireEphEvent,
          WireEventResp,
          WireObject,
          WireReqResp,
          WireRequest,
          WireSysEvent,
          ClientIdentity,
          TimerInstance,
          SYS_EVENT,
          UPromise,
          NetworkType       } from '@mubble/core'

import {  WsBrowser }         from './ws-browser'
import {  EventSystem }       from '../util'

const TIMEOUT_MS          = 15000,
      SEND_RETRY_MS       = 1000,
      SEND_TIMEOUT        = 10000,
      EVENT_SEND_DELAY    = 1000,
      MAX_EVENTS_TO_SEND  = 5

export interface BrowserConnectionInfo extends  ConnectionInfo {
  provider : WsBrowser
} 

export abstract class XmnRouterBrowser {

  private ci              : BrowserConnectionInfo
  private ongoingRequests : WireRequest[] = []
  private eventSubMap     : Mubble.uObject<(rc: RunContextBrowser, name: string, data: any)=>any> = {}
  
  private timerReqResend: TimerInstance
  private timerReqTimeout: TimerInstance
  private timerEventTimeout: TimerInstance

  private db: XmnDb

  // This flag indicates that events can be sent. This is to allow application to
  // have control when events are being sent. Normally, events are sent after 
  // getting client identity or login. But in background runs, events can be sent 
  // immediately

  private lastEventTs      = 0
  private lastEventSendTs  = 0
  private syncKey: Uint8Array

  constructor(private rc: RunContextBrowser, serverUrl: string, ci: ConnectionInfo, syncKey: string) {

    const urlParser     = document.createElement('a')
    urlParser.href      = serverUrl

    this.ci             = ci as BrowserConnectionInfo
    this.ci.protocol    = Protocol.WEBSOCKET
    this.ci.host        = urlParser.hostname
    this.ci.port        = Number(urlParser.port) || 80

    this.timerReqResend    = rc.timer.register('router-resend', this.cbTimerReqResend.bind(this))
    this.timerReqTimeout   = rc.timer.register('router-req-timeout', this.cbTimerReqTimeout.bind(this))
    this.timerEventTimeout = rc.timer.register('router-event-timeout', this.cbTimerEventTimeout.bind(this))

    const cls:any = Uint8Array
    this.syncKey  = cls.from(atob(syncKey), c => c.charCodeAt(0))      

    // rc.isDebug() && rc.debug(rc.getName(this), 'constructor')
  }

  async setNetwork(netType: string) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'setNetwork', netType)
    if (netType) {
      this.prepareConnection(this.rc)
      if (await this.initEvents()) this.trySendingEvents(this.rc) // not awaiting as it will introduce delay
    }
  }

  getSyncKey() { return this.syncKey }
  abstract async upgradeClientIdentity(rc: RunContextBrowser, clientIdentity: ClientIdentity)
  abstract getNetworkType(rc: RunContextBrowser): string
  abstract getLocation(rc: RunContextBrowser): string
  abstract getClientIdentity(rc: RunContextBrowser): ClientIdentity
    
  async sendRequest(rc: RunContextBrowser, apiName: string, data: object): Promise<object> {

    return new Promise((resolve, reject) => {

      const wr = new WireRequest(apiName, data, 0, resolve, reject)
      this.ongoingRequests.push(wr)

      if (!this.ci.provider) this.prepareConnection(rc)

      if (!this.ci.provider.send(rc, [wr])) {
        wr._isSent = true
        rc.isDebug() && rc.debug(rc.getName(this), 'sent request', wr)
        this.timerReqTimeout.tickAfter(TIMEOUT_MS)
      } else {
        rc.isStatus() && rc.status(rc.getName(this), 'send to be retried', wr)
        this.timerReqResend.tickAfter(SEND_RETRY_MS)
      }
    })
  }

  async sendPersistentEvent(rc: RunContextBrowser, eventName: string, data: object) {
    
    if (!this.ci.provider) this.prepareConnection(rc)
      const clientIdentity = this.ci.clientIdentity

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'sendPersistentEvent', eventName, 
      'clientIdentity', clientIdentity && clientIdentity.clientId)

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), clientIdentity && clientIdentity.clientId, 
      'You cannot send events without clientId')

    if (await this.initEvents()) {

      const event      = new WireEvent(eventName, data),
            eventTable = new EventTable(event)

      await eventTable.save(this.db)
      await this.trySendingEvents(rc)
    }
  }

  async sendEphemeralEvent(rc: RunContextBrowser, eventName: string, data: object) {
    
    if (!this.ci.provider) this.prepareConnection(rc)
      const clientIdentity = this.ci.clientIdentity

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'sendEphemeralEvent', eventName, 
      'clientIdentity', clientIdentity && clientIdentity.clientId)

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), clientIdentity && clientIdentity.clientId, 
      'You cannot send events without clientId')

    const event      = new WireEphEvent(eventName, data)
    this.ci.provider.sendEphemeralEvent(event)
  }

  public subscribeEvent(eventName: string, eventHandler: 
      (rc: RunContextBrowser, name: string, data: any) => any) {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), eventName && eventHandler)
    this.eventSubMap[eventName] = eventHandler
  }


  private prepareConnection(rc: RunContextBrowser) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'prepareConnection', !!this.ci.provider)
    this.ci.networkType     = this.getNetworkType(rc)
    this.ci.location        = this.getLocation(rc)
    this.ci.clientIdentity  = this.getClientIdentity(rc)
    this.ci.publicRequest   = !this.ci.clientIdentity
    if (!this.ci.provider) this.ci.provider = new WsBrowser(rc, this.ci, this)
  }

  private async initEvents() {

    const clientIdentity = this.ci.clientIdentity

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'initEvents', !!this.db)

    if (!this.db && clientIdentity && clientIdentity.clientId) {
      this.db = new XmnDb(this.ci.clientIdentity.clientId)
      await EventTable.removeOldByTs(this.rc, this.db, Date.now() - 7 * 24 * 3600000 /* 7 days */)
    }
    return !!this.db
  }

  private async trySendingEvents(rc: RunContextBrowser) {

    if (!this.ci.networkType || this.lastEventTs) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Skipping sending event as not ready', {
        networkType         : this.ci.networkType,
        lastEventTs         : this.lastEventTs
      })
      return
    }

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'trySendingEvents', !!this.db)

    const arEvent = await EventTable.getOldEvents(rc, this.db)
    if (!arEvent.length) return

    // We need to guard trigger from the timeout timer, while waiting to get data from event table, earlier trySendingEvents
    // has succeeded
    if (this.lastEventTs) return

    for (let index = 0; index < arEvent.length; index++) {

      if (!this.ci.provider) this.prepareConnection(rc)
      
      const eventTable = arEvent[index],
            wireEvent  = new WireEvent(eventTable.name, JSON.parse(eventTable.data), eventTable.ts)

      if (this.ci.provider.send(rc, [wireEvent])) break // failed to send

      rc.isDebug() && rc.debug(rc.getName(this), 'sent event', wireEvent)
      this.lastEventTs      = wireEvent.ts
      this.lastEventSendTs  = Date.now()
      this.timerEventTimeout.tickAfter(TIMEOUT_MS, true)
      await UPromise.delayedPromise(EVENT_SEND_DELAY)
    }
  }

  async providerReady() {

    this.cbTimerReqResend()

    const clientIdentity = this.ci.clientIdentity
    if (clientIdentity && clientIdentity.clientId) {
      if (await this.initEvents()) this.trySendingEvents(this.rc) // not awaiting as it will introduce delay
    }
  }

  providerFailed(errCode ?: string) {
  
    // finishRequest removed the item from ongoingRequests array
    while (this.ongoingRequests.length) {
      const wr = this.ongoingRequests[0];
      this.finishRequest(this.rc, 0, errCode || XmnError.ConnectionFailed)
    }
    this.ongoingRequests  = []
    this.lastEventTs      = 0
    this.lastEventSendTs  = 0
  }

  async providerMessage(rc: RunContextBrowser, arData: WireObject[]) {

    for (let index = 0; index < arData.length; index++) {

      const wo = arData[index]
      rc.isDebug() && rc.debug(rc.getName(this), `providerMessage@${index}`, wo)

      switch (wo.type) {

        case WIRE_TYPE.REQUEST:
          this.rc.isError() && this.rc.error(this.rc.getName(this), 'Not implemented', wo)
          break

        case WIRE_TYPE.EPH_EVENT:
          const handler = this.eventSubMap[wo.name]
          if (handler) {
            await handler(rc, wo.name, wo.data)
          } else {
            EventSystem.broadcast(rc, wo.name, wo.data)
          }
          break

        case WIRE_TYPE.EVENT_RESP:
          const eventResp = wo as WireEventResp
          rc.isAssert() && rc.assert(rc.getName(this), eventResp.ts)

          await EventTable.removeOldByTs(rc, this.db, eventResp.ts)
          if (this.lastEventTs === eventResp.ts) {
            this.lastEventTs      = 0
            this.lastEventSendTs  = 0
            this.timerEventTimeout.remove()
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

          await this.finishRequest(this.rc, index, resp.error, resp.data)
          break

        case WIRE_TYPE.SYS_EVENT:
          await this.processSysEvent(this.rc, wo)
          break

        default:
          this.rc.isError() && this.rc.error(this.rc.getName(this), 'Unknown message', wo)
      }
    }
  }

  private async processSysEvent(rc: RunContextBrowser, se: WireSysEvent) {
    if (se.name === SYS_EVENT.UPGRADE_CLIENT_IDENTITY) {
      await this.upgradeClientIdentity(rc, se.data as ClientIdentity)
      this.prepareConnection(rc)
    } else {
      await this.ci.provider.processSysEvent(this.rc, se)
    }
  }

  private cbTimerReqResend(): number {

    const wr = this.ongoingRequests.find(wr => !wr._isSent)
    if (!wr || !this.ci.provider) return 0

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

    if (!this.lastEventSendTs) return 0

    const diff = this.lastEventSendTs + TIMEOUT_MS - Date.now()
    if (diff > 0) return diff

    this.lastEventTs      = 0
    this.lastEventSendTs  = 0

    this.trySendingEvents(this.rc)
    return TIMEOUT_MS
  }

  private finishRequest(rc: RunContextBrowser, index: number, errorCode: string | null, data ?: object) {

    const wr  = this.ongoingRequests[index],
          now = Date.now()

    this.ongoingRequests.splice(index, 1)
    
    if (!wr.resolve) {

      rc.isStatus() && rc.status(rc.getName(this), 'Trying to finish already finished request', errorCode,
        wr.name, 'created at', new Date(wr.ts), 'timeTaken', now - wr.ts, 'ms')

      return  
    }

    if (errorCode) {

      rc.isStatus() && rc.status(rc.getName(this), 'Request failed with code', errorCode,
        wr.name, 'created at', new Date(wr.ts), 'timeTaken', now - wr.ts, 'ms')
      
      wr.reject(new Error(errorCode))

    } else {

      rc.isStatus() && rc.status(rc.getName(this), 'Request succeeded', 
        wr.name, 'created at', new Date(wr.ts), 'timeTaken', now - wr.ts, 'ms')

      wr.resolve(data)  
    }

    wr.reject  = null
    wr.resolve = null
  }

} // end of class

class EventTable {

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

  /**
   * Static functions for io
   */
  static async getOldEvents(rc: RunContextBrowser, db: XmnDb): Promise<EventTable[]> {
    const ar = await db.events.orderBy('ts').limit(MAX_EVENTS_TO_SEND).toArray(),
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
}
// http://dexie.org/docs/Typescript.html
class XmnDb extends Dexie {

  events: Dexie.Table<EventTable, number> // number: type of primary key
  constructor (clientId: number) {
    super('xmn-' + clientId)
    this.version(1).stores({
      events: 'ts'
    })
    this.events.mapToClass(EventTable)
  }
}

