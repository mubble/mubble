/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import * as http              from 'http'
import {
        XmnRegistry
       }                      from './xmn-registry'
import { 
        ConnectionInfo, 
        ClientIdentity,
        WIRE_TYPE,
        WireEvent,
        WireEventResp,
        WireObject,
        WireReqResp,
        WireRequest,
        WireSysEvent,
        SYS_EVENT,
        InvocationData,
        Protocol
       }                      from '@mubble/core'
import {EncProviderServer}    from './enc-provider-server'
import {RunContextServer}     from '../rc-server'

export class InvokeStruct {

  constructor(public name      : string,
              public parent    : any,
              public xmnInfo   : any) {
  
  }

  async executeFn(...params: any[]) {
    let fn = this.parent[this.name]
    if (fn) return await fn.call(parent, ...params)

    const obj = new this.parent()
    return await obj[this.name].call(obj, ...params)
  }
}

export abstract class XmnRouterServer {

  private apiMap   : {[index: string]: InvokeStruct} = {}
  private eventMap : {[index: string]: InvokeStruct} = {}

  constructor(rc: RunContextServer, ...providers: any[]) {
    XmnRegistry.commitRegister(rc, this, providers)   
  }

  abstract verifyConnection(rc: RunContextServer, ci: ConnectionInfo): boolean 

  public sendEvent(rc: RunContextServer, ci: ConnectionInfo, eventName: string, data: object) {

    if (!ci.provider) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Could not send event as connection closed', eventName)
      return
    }

    const we = new WireEvent(eventName, data)
    ci.provider.send(rc, we)
    rc.isDebug() && rc.debug(rc.getName(this), 'sendEvent', eventName)
  }
  
  getIp(req: any) {

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
          i  = ip.indexOf(',') // "127.0.0.1, 119.81.86.214"

    return i === -1 ? ip : ip.substr(i + 1).trim()
  }

  providerMessage(rc: RunContextServer, ci: ConnectionInfo, arData: any[]) {

    for (const wo of arData) {

      rc.isDebug() && rc.debug(rc.getName(this), 'providerMessage', wo)

      switch (wo.type) {

        case WIRE_TYPE.REQUEST:
        this.routeRequest(rc, ci, wo)
        break

        case WIRE_TYPE.EVENT:
        this.routeEvent(rc, ci, wo)
        break

        case WIRE_TYPE.EVENT_RESP:
        case WIRE_TYPE.REQ_RESP:
        rc.isDebug() && rc.debug(rc.getName(this), 'Received', wo)
        break
      }
    }
  }

  providerFailed(rc: RunContextServer, ci: ConnectionInfo) {
    this.connectionClosed(rc, ci)
  }
  
  providerClosed(rc: RunContextServer, ci: ConnectionInfo) {
    this.connectionClosed(rc, ci)
  }

  abstract connectionClosed(rc: RunContextServer, ci: ConnectionInfo): void

  async routeRequest(rc: RunContextServer, ci : ConnectionInfo, wo: WireObject) {

    try {
      const reqStruct = this.apiMap[wo.name]
      rc.isDebug() && rc.debug(rc.getName(this), wo, reqStruct)
      
      if (!reqStruct) throw(Error(rc.error(rc.getName(this), 'Unknown api called', wo.name)))
      
      const ir = {
        name    : wo.name,
        ts      : wo.ts + ci.msOffset,
        params  : wo.data
      } as InvocationData
      const resp = await this.invokeXmnFunction(rc, ci, ir, reqStruct, false)
      this.sendToProvider(rc, ci, new WireReqResp(ir.name, wo.ts, resp) , wo)

    } catch (err) {
      let errStr = (err instanceof Error) ? err.message : err
      rc.isError() && rc.error(rc.getName(this), err)
      this.sendToProvider(rc, ci, new WireReqResp(wo.name, wo.ts, 
                       {error: err.message || err.name}, errStr) , wo)
    }
 }

  async routeEvent(rc: RunContextServer, ci: ConnectionInfo, wo: WireObject) {

    try {

      if (!ci.lastEventTs || wo.ts > ci.lastEventTs) { // TODO: (CG) To fix...
        
        const eventStruct = this.eventMap[wo.name]
        if (!eventStruct) throw(Error(rc.error(rc.getName(this), 'Unknown event called', wo.name)))
        const ie = {
          name    : wo.name,
          ts      : wo.ts + ci.msOffset,
          params  : wo.data
        } as InvocationData

        await this.invokeXmnFunction(rc, ci, ie, eventStruct, true)
      }

      this.sendEventResponse(rc, ci, new WireEventResp(wo.name, wo.ts) , wo)

    } catch (err) {
      
      let errStr = (err instanceof Error) ? err.message : err
      rc.isError() && rc.error(rc.getName(this), err)
      this.sendEventResponse(rc, ci, new WireEventResp(wo.name, wo.ts, 
                       {error: err.message || err.name}, errStr ) ,wo)
    }
  }

  async invokeXmnFunction(rc: RunContextServer, ci: ConnectionInfo, 
                          invData: InvocationData, invStruct: InvokeStruct, isEvent: boolean) {

    return await invStruct.executeFn(rc, ci, invData, invStruct, isEvent)
  }

  private async sendEventResponse(rc: RunContextServer, ci: ConnectionInfo, resp: WireEventResp , req : WireObject ) {
    if (ci.lastEventTs < resp.ts) ci.lastEventTs = resp.ts
    await this.sendToProvider(rc, ci, resp , req)
  }

  private sendToProvider(rc: RunContextServer, ci: ConnectionInfo, response: WireObject , request: WireObject | null ): void {
    if (ci.provider) {
      ci.provider.send(rc, response)
    } else {
      rc.isStatus() && rc.status(rc.getName(this), 'Not sending response as provider is closed')
    }
    
    try{
      if(request && (response.type === WIRE_TYPE.EVENT_RESP || response.type === WIRE_TYPE.REQ_RESP)){
          rc.finish(ci ,  response as any , request )
      }
    }
    catch(err){
      console.log('rc finish err',err)
    }
    
  }

  upgradeClientIdentity(rc   : RunContextServer, 
                        ci   : ConnectionInfo, 
                        data : object) {

    rc.isAssert() && rc.assert(rc.getName(this), ci.clientIdentity)
    let updated = false

    for (const key of Object.keys(data)) {

      const val = (data as any)[key]
      rc.isAssert() && rc.assert(rc.getName(this), typeof(val) === 'string' || typeof(val) === 'number')
      const oldVal = ci.clientIdentity

      if (val != oldVal) {
        (ci.clientIdentity as any)[key] = val
        updated = true
      }
    }

    if (updated) {
      this.sendToProvider(rc, ci, new WireSysEvent(SYS_EVENT.UPGRADE_CLIENT_IDENTITY, ci.clientIdentity) , null)
    }
  }

  // Preferred way is to use @xmnApi
  registerApi(rc: RunContextServer, name: string, parent: any, xmnInfo: any): void {
    if (this.apiMap[name]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate api:' + name)))
    }
    if (parent[name] || (parent.prototype && parent.prototype[name])) {
      if (rc.isDebug()) this.logRegistration(rc, name, parent, true)
      this.apiMap[name] = new InvokeStruct(name, parent, xmnInfo)
    } else {
      throw(Error(rc.error(rc.getName(this), 'api', name, 'does not exit in', rc.getName(parent))))
    }
  }

  // Preferred way is to use @xmnEvent
  registerEvent(rc: RunContextServer, name: string, parent: any, xmnInfo: any): void {
    if (this.eventMap[name]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate event:' + name)))
    }
    if (parent[name] || (parent.prototype && parent.prototype[name])) {
      if (rc.isDebug()) this.logRegistration(rc, name, parent, false)
      this.eventMap[name] = new InvokeStruct(name, parent, xmnInfo)
    } else {
      throw(Error(rc.error(rc.getName(this), 'event', name, 'does not exit in', rc.getName(parent))))
    }
  }

  private logRegistration(rc: RunContextServer, name: string, parent: any, isApi: boolean) {

    const pName  = rc.getName(parent),
          lpName = lo.lowerFirst(pName)

    rc.debug(rc.getName(this), 'Registered', isApi ? 'api' : 'event',  'like',
      parent[name] ? 
        (parent.prototype ? `'static ${pName}.${name}()'` : `'singleton ${lpName}.${name}()'`) : 
        `'new ${pName}().${name}()'`
    )
  }
}