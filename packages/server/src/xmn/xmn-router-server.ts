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
        WireEphEvent,
        WireEventResp,
        WireObject,
        WireReqResp,
        WireRequest,
        WireSysEvent,
        SYS_EVENT,
        InvocationData,
        Protocol,
        Mubble
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
    if (fn) return await fn.call(this.parent, ...params)

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

  abstract getPrivateKeyPem(rc: RunContextServer, ci: ConnectionInfo): string

  async verifyConnection(rc: RunContextServer, ci: ConnectionInfo, apiName ?: string) {
    const reqStruct = apiName ? this.apiMap[apiName] : null
    await this.connectionOpened(rc, ci, reqStruct ? reqStruct.xmnInfo : null)
  }
  
  public async sendEvent(rc: RunContextServer, ci: ConnectionInfo, eventName: string, data: object) {

    if (!ci.provider) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Could not send event as connection closed', eventName)
      return
    }

    const we = new WireEphEvent(eventName, data)
    await ci.provider.send(rc, we)
    rc.isDebug() && rc.debug(rc.getName(this), 'sendEvent', eventName)
  }
  
  public getIp(req: any) {

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
          i  = ip.indexOf(',') // "127.0.0.1, 119.81.86.214"

    return i === -1 ? ip : ip.substr(i + 1).trim()
  }

  providerMessage(refRc: RunContextServer, ci: ConnectionInfo, arData: WireObject[]) {
    
    for (const wo of arData) {

      if ([WIRE_TYPE.REQUEST, WIRE_TYPE.EVENT, WIRE_TYPE.EPH_EVENT].indexOf(wo.type) !== -1) {

        const rc : RunContextServer = refRc.copyConstruct('', refRc.contextName)
        rc.isDebug() && rc.debug(rc.getName(this), 'providerMessage', wo)

        const wPrResp: Promise<any> = 
          wo.type === WIRE_TYPE.REQUEST ? this.routeRequest(rc, ci, wo) : 
          (wo.type === WIRE_TYPE.EVENT  ? this.routeEvent(rc, ci, wo)   : 
                                          this.routeEphemeralEvent(rc, ci, wo))
        
        wPrResp.then((resp) => {
          rc.finish(ci , typeof resp === 'boolean' ? null : resp, wo)
        })
      }
    }
  }

  async providerFailed(rc: RunContextServer, ci: ConnectionInfo) {
    await this.connectionClosed(rc, ci)
    rc.finish(ci , null as any , null as any)
  }
  
  async providerClosed(rc: RunContextServer, ci: ConnectionInfo) {
    await this.connectionClosed(rc, ci)
    if (ci.protocol === Protocol.WEBSOCKET) {
      rc.finish(ci , null as any , null as any)
    }
  }

  abstract connectionOpened(rc: RunContextServer, ci: ConnectionInfo, apiInfo: any): Promise<void>
  abstract connectionClosed(rc: RunContextServer, ci: ConnectionInfo): void

  async routeRequest(rc: RunContextServer, ci : ConnectionInfo, wo: WireObject) : Promise<WireReqResp> {
    
    let wResp : WireReqResp  = null as any
    try {
      const reqStruct = this.apiMap[wo.name] 
      rc.isDebug() && rc.debug(rc.getName(this), wo, reqStruct)
      
      if (!reqStruct) {
        throw(Error(rc.error(rc.getName(this), 'Unknown api called', wo.name)))
      }
      
      const ir = {
        name    : wo.name,
        ts      : wo.ts + ci.msOffset,
        params  : wo.data
      } as InvocationData
      const resp = await this.invokeXmnFunction(rc, ci, ir, reqStruct, false)
      wResp = new WireReqResp(ir.name, wo.ts, resp)
      await this.sendToProvider(rc, ci, wResp , wo)

    } catch (err) {
      let errStr = (err instanceof Mubble.uError) ? err.code 
                 : (
                      (err instanceof Error) ? err.message : err
                   )
      rc.isError() && rc.error(rc.getName(this), err)
      wResp = new WireReqResp(wo.name, wo.ts, 
                       {error: err.message || err.name}, errStr , err)
      await this.sendToProvider(rc, ci, wResp , wo)
    } finally {
      return wResp
    }
 }

  async routeEvent(rc: RunContextServer, ci: ConnectionInfo, wo: WireObject) : Promise<WireEventResp> {
    
    let wResp : WireEventResp  = null as any
    try {
      if (wo.ts > ci.lastEventTs) {
        const eventStruct = this.eventMap[wo.name]
        if (!eventStruct) throw(Error(rc.error(rc.getName(this), 'Unknown event called', wo.name)))
        const ie = {
          name    : wo.name,
          ts      : wo.ts + ci.msOffset,
          params  : wo.data
        } as InvocationData

        await this.invokeXmnFunction(rc, ci, ie, eventStruct, true)
      }

      wResp = new WireEventResp(wo.name, wo.ts)
      this.sendEventResponse(rc, ci, wResp , wo)

    } catch (err) {
      
      let errStr =  (err instanceof Mubble.uError) ? err.code :
                   ((err instanceof Error) ? err.message : err)

      rc.isError() && rc.error(rc.getName(this), err)

      wResp = new WireEventResp(wo.name, wo.ts, 
                       {error: err.message || err.name}, errStr , err)
      this.sendEventResponse(rc, ci, wResp  ,wo)

    }

    return wResp
  }

  async routeEphemeralEvent(rc: RunContextServer, ci: ConnectionInfo, wo: WireObject) {
    
    try {

      const eventStruct = this.eventMap[wo.name]
      if (!eventStruct) throw(Error(rc.error(rc.getName(this), 'Unknown event called', wo.name)))
      const ie = {
        name    : wo.name,
        ts      : wo.ts + ci.msOffset,
        params  : wo.data
      } as InvocationData

      await this.invokeXmnFunction(rc, ci, ie, eventStruct, true)

    } catch (err) {
      
      let errStr = (err instanceof Mubble.uError) ? err.code 
                 : (
                      (err instanceof Error) ? err.message : err
                   )
      rc.isError() && rc.error(rc.getName(this), err)
    }

    return true
  }

  async invokeXmnFunction(rc: RunContextServer, ci: ConnectionInfo, 
                          invData: InvocationData, invStruct: InvokeStruct, isEvent: boolean) {

    return await invStruct.executeFn(rc, ci, invData, invStruct, isEvent)
  }

  private async sendEventResponse(rc: RunContextServer, ci: ConnectionInfo, resp: WireEventResp , req : WireObject ) {
    if (ci.lastEventTs < resp.ts) ci.lastEventTs = resp.ts // this is same as req.ts
    await this.sendToProvider(rc, ci, resp , req)
  }

  private async sendToProvider(rc: RunContextServer, ci: ConnectionInfo, response: WireObject , request: WireObject | null) {
    if (ci.provider) {
      await ci.provider.send(rc, response, response.data ? response.data.error : undefined)
    } else {
      rc.isStatus() && rc.status(rc.getName(this), 'Not sending response as provider is closed')
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
    const apiName = xmnInfo.name
    if (this.apiMap[apiName]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate api:' + apiName)))
    }
    if (parent[name] || (parent.prototype && parent.prototype[name])) {
      if (rc.isDebug()) this.logRegistration(rc, apiName , name, parent, true)
      this.apiMap[apiName] = new InvokeStruct(name, parent, xmnInfo)
    } else {
      throw(Error(rc.error(rc.getName(this), 'api', name, 'does not exit in', rc.getName(parent))))
    }
  }

  // Preferred way is to use @xmnEvent
  registerEvent(rc: RunContextServer, name: string, parent: any, xmnInfo: any): void {
    const apiName = xmnInfo.name
    if (this.eventMap[apiName]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate event:' + apiName)))
    }
    if (parent[name] || (parent.prototype && parent.prototype[name])) {
      if (rc.isDebug()) this.logRegistration(rc, apiName , name, parent, false)
      this.eventMap[apiName] = new InvokeStruct(name, parent, xmnInfo)
    } else {
      throw(Error(rc.error(rc.getName(this), 'event', name, 'does not exit in', rc.getName(parent))))
    }
  }

  private logRegistration(rc: RunContextServer, apiName: string , fnName: string, parent: any, isApi: boolean) {

    const pName  = rc.getName(parent),
          lpName = lo.lowerFirst(pName)

    rc.debug(rc.getName(this), 'Registered', isApi ? 'api' : 'event', apiName ,  'like',
      parent[fnName] ? 
        (parent.prototype ? `'static ${pName}.${fnName}()'` : `'singleton ${lpName}.${fnName}()'`) : 
        `'new ${pName}().${fnName}()'`
    )
  }
}