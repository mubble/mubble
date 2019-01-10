/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import {
        XmnRegistry
       }                      from './xmn-registry'
import { 
        ConnectionInfo, 
        ClientIdentity,
        WIRE_TYPE,
        WireEphEvent,
        WireEventResp,
        WireObject,
        WireReqResp,
        WireSysEvent,
        SYS_EVENT,
        InvocationData,
        Protocol,
        Mubble,
        ActiveProviderCollection,
        XmnProvider
       }                      from '@mubble/core'
import {RunContextServer}     from '../rc-server'
import {web}                  from './web'

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

  private apiMap             : {[index: string]: InvokeStruct} = {}
  private eventMap           : {[index: string]: InvokeStruct} = {}
  private piggyfrontMap                                        = new WeakMap<InvocationData, Array<WireEphEvent>>()
  private providerCollection : ActiveProviderCollection

  constructor(rc: RunContextServer, ...apiProviders: any[]) {
    XmnRegistry.commitRegister(rc, this, apiProviders)

    this.providerCollection = web.getActiveProviderCollection(rc)  
  }

  abstract getPrivateKeyPem(rc: RunContextServer, ci: ConnectionInfo): string

  async verifyConnection(rc: RunContextServer, ci: ConnectionInfo, apiName ?: string) {
    //const rc : RunContextNcServer = refRc.copyConstruct('', refRc.contextName)
    const reqStruct = apiName ? this.apiMap[apiName] : null
    await this.connectionOpened(rc, ci, reqStruct ? reqStruct.xmnInfo : null)
    const apiname = 'verifyConnection'
    if(ci.clientIdentity){
      rc.finish(ci , null as any , null as any , apiname)
    }else if(ci.protocol === Protocol.WEBSOCKET){
      // TraceBase.sendTrace(rc, apiname , {type: 'NC_API'})
    }
    
  }
  
  public async sendEvent(rc: RunContextServer, ci: ConnectionInfo, eventName: string, data: object) {

    if (!ci.provider) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Could not send event as connection closed', eventName)
      return
    }

    const we = new WireEphEvent(eventName, data)
    await ci.provider.send(rc, [we])
    rc.isDebug() && rc.debug(rc.getName(this), 'sendEvent', eventName)
  }
  
  public async piggyfrontEvent(rc: RunContextServer, ci: ConnectionInfo, 
    eventName: string, data: object, invData: InvocationData) {
    const we = new WireEphEvent(eventName, data)
    this.insertIntoPiggyfrontMap(rc, we, invData)
  }

  private insertIntoPiggyfrontMap(rc: RunContextServer, we: WireObject, invData: InvocationData) {
    const ar = this.piggyfrontMap.get(invData) || []
    if (!ar.length) this.piggyfrontMap.set(invData, ar)
    ar.push(we)
    rc.isDebug() && rc.debug(rc.getName(this), 'queued event', we.name)
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
    const ir = {
      name    : wo.name,
      ts      : wo.ts + ci.msOffset,
      params  : wo.data
    } as InvocationData

    try {
      const reqStruct = this.apiMap[wo.name] 
      wo.name!=='httpecho' && rc.isDebug() && rc.debug(rc.getName(this), 'Routing Request', wo, reqStruct)
      
      if (!reqStruct) {
        throw(Error(rc.error(rc.getName(this), 'Unknown api called', wo.name)))
      }
      
      const resp = await this.invokeXmnFunction(rc, ci, ir, reqStruct, false)
      wResp = new WireReqResp(ir.name, wo.ts, resp)
      await this.sendToProvider(rc, ci, wResp, ir)

    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), err)

      const data = {
        errorCode    : err.code || err.name,
        errorMessage : err.msg || err.message
      }

      wResp = new WireReqResp(wo.name, wo.ts, data, err.code || err.name || err,
                              err.msg || err.message || err, err)
      await this.sendToProvider(rc, ci, wResp, ir)
    } finally {
      return wResp
    }
 }

  async routeEvent(rc: RunContextServer, ci: ConnectionInfo, wo: WireObject) : Promise<WireEventResp> {
    
    let wResp : WireEventResp  = null as any
    const ie = {
      name    : wo.name,
      ts      : wo.ts + ci.msOffset,
      params  : wo.data
    } as InvocationData

    try {
      if (wo.ts > ci.lastEventTs) {
        const eventStruct = this.eventMap[wo.name]
        if (!eventStruct) throw(Error(rc.error(rc.getName(this), 'Unknown event called', wo.name)))

        await this.invokeXmnFunction(rc, ci, ie, eventStruct, true)
      }

      wResp = new WireEventResp(wo.name, wo.ts)
      this.sendEventResponse(rc, ci, wResp, ie)

    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), err)

      const data = {
        errorCode    : err.code || err.name,
        errorMessage : err.msg || err.message
      }

      wResp = new WireEventResp(wo.name, wo.ts, data, err.code || err.name || err,
                                err.msg || err.message || err, err)
      this.sendEventResponse(rc, ci, wResp, ie)
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

  closeConnection(rc : RunContextServer, ci : ConnectionInfo) {
    if(ci.provider) {
      ci.provider.requestClose()
    } else {
      rc.isDebug() && rc.debug(rc.getName(this), 'Cannot close the connection as provider is closed.')
    }
  }

  async invokeXmnFunction(rc: RunContextServer, ci: ConnectionInfo, 
                          invData: InvocationData, invStruct: InvokeStruct, isEvent: boolean) {

    return await invStruct.executeFn(rc, ci, invData, invStruct, isEvent)
  }

  private async sendEventResponse(rc: RunContextServer, ci: ConnectionInfo, 
                                  resp: WireEventResp , invData : InvocationData ) {

    if (ci.lastEventTs < resp.ts) ci.lastEventTs = resp.ts // this is same as req.ts
    await this.sendToProvider(rc, ci, resp , invData)
  }

  private async sendToProvider(rc: RunContextServer, ci: ConnectionInfo, 
                  response: WireObject, invData: InvocationData | null) {
    if (ci.provider) {

      const ar = invData && this.piggyfrontMap.get(invData) || []
      if (invData && ar.length) this.piggyfrontMap.delete(invData)
      
      ar.push(response)
      
      const err = (response as WireReqResp|WireEventResp).errorCode
      // Do not send piggy front events if error api execution fails
      await ci.provider.send(rc, err? [response] : ar)

    } else {
      rc.isStatus() && rc.status(rc.getName(this), 'Not sending response as provider is closed')
    }
  }

  upgradeClientIdentity(rc   : RunContextServer, 
                        ci   : ConnectionInfo, 
                        data : Mubble.uChildObject<ClientIdentity> , invData: InvocationData) {
    
    rc.isAssert() && rc.assert(rc.getName(this), ci.clientIdentity)
    let updated = !lo.isEqual(data , lo.pick(ci.clientIdentity , Object.keys(data)))

    if (updated) {
      lo.assign(ci.clientIdentity , data)
      this.insertIntoPiggyfrontMap(rc, 
        new WireSysEvent(SYS_EVENT.UPGRADE_CLIENT_IDENTITY, ci.clientIdentity), 
        invData)
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

  public addToProviderCollection(rc : RunContextServer, clientId : number, provider : XmnProvider) {
    // this.providerCollection.addActiveProvider(clientId, provider)
  }

  public getClientProvider(rc : RunContextServer, clientId : number) {
    // return this.providerCollection.getActiveProvider(clientId)
  }

  private logRegistration(rc: RunContextServer, apiName: string , fnName: string, parent: any, isApi: boolean) {

    // const pName  = rc.getName(parent),
    //       lpName = lo.lowerFirst(pName)

    // rc.debug(rc.getName(this), 'Registered', isApi ? 'api' : 'event', apiName ,  'like',
    //   parent[fnName] ? 
    //     (parent.prototype ? `'static ${pName}.${fnName}()'` : `'singleton ${lpName}.${fnName}()'`) : 
    //     `'new ${pName}().${fnName}()'`
    // )
  }
}
