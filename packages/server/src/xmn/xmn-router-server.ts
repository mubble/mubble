/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         ConnectionInfo,
         WIRE_TYPE,
         WireEphEvent,
         WireEventResp,
         WireObject,
         WireReqResp,
         InvocationData,
         Protocol,
         Mubble,
         XmnProvider
       }                              from '@mubble/core'
import { RunContextServer }           from '../rc-server'
import { ConnectionMap }              from './connection-map'
import { RedisWrapper }               from '../cache'
import { XmnRegistry }                from './xmn-registry'
import { HttpsThirdServerProvider }   from './https-third-server'

const EVENT_QUEUE = 'event-queue:'

export type ClientEventObject = {
  workerId     : string
  connectionId : string
  eventName    : string
  eventParams  : Mubble.uObject<any> 
}

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
  private reqRedis           : RedisWrapper
  private eventRedis         : RedisWrapper

  constructor(rc: RunContextServer, reqRedis : RedisWrapper, serverId : string, ...apiProviders: any[]) {
    XmnRegistry.commitRegister(rc, this, apiProviders)
    this.reqRedis = reqRedis

    //ConnectionMap.init(serverId, reqRedis)
  }
  
  public async verifyConnection(rc       : RunContextServer,
                                ci       : ConnectionInfo,
                                apiName ?: string) {

    //const rc : RunContextNcServer = refRc.copyConstruct('', refRc.contextName)

    const reqStruct = apiName ? this.apiMap[apiName] : null
    await this.connectionOpened(rc, ci, reqStruct ? reqStruct.xmnInfo : null)
  }
  
  public async sendEvent(rc : RunContextServer, ci : ConnectionInfo, eventName : string, data : object) {

    if (!ci.provider) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Could not send event as connection closed', eventName)
      return
    }

    const we = new WireEphEvent(eventName, data)
    await ci.provider.send(rc, [we])
    rc.isDebug() && rc.debug(rc.getName(this), 'sendEvent', eventName)
  }
  
  public piggyfrontEvent(rc: RunContextServer, ci: ConnectionInfo, 
    eventName: string, data: object, invData: InvocationData) {
    const we = new WireEphEvent(eventName, data)
    this.insertIntoPiggyfrontMap(rc, we, invData)
  }

  private insertIntoPiggyfrontMap(rc      : RunContextServer,
                                  we      : WireObject,
                                  invData : InvocationData) {

    const ar = this.piggyfrontMap.get(invData) || []
    if (!ar.length) this.piggyfrontMap.set(invData, ar)
    ar.push(we)
    rc.isDebug() && rc.debug(rc.getName(this), 'queued event', invData.name, we.name)
  }
  
  public getIp(req: any) {

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
          i  = ip.indexOf(',') // "127.0.0.1, 119.81.86.214"

    return i === -1 ? ip : ip.substr(i + 1).trim()
  }

  providerMessage(refRc  : RunContextServer,
                  ci     : ConnectionInfo,
                  arData : WireObject[]) {
    
    for (const wo of arData) {

      if ([WIRE_TYPE.REQUEST, WIRE_TYPE.EVENT, WIRE_TYPE.EPH_EVENT].indexOf(wo.type) !== -1) {

        const rc : RunContextServer = refRc.copyConstruct('', refRc.contextName)
        rc.isDebug() && rc.debug(rc.getName(this), 'providerMessage', wo)

        const wPrResp: Promise<any> = 
          wo.type === WIRE_TYPE.REQUEST ? this.routeRequest(rc, ci, wo)
                                        : (wo.type === WIRE_TYPE.EVENT ? this.routeEvent(rc, ci, wo) 
                                                                       : this.routeEphemeralEvent(rc, ci, wo))

        wPrResp.then((resp) => {
          rc.finish(ci , typeof resp === 'boolean' ? null : resp, wo)
        })
      }
    }
  }

  async providerFailed(rc: RunContextServer, ci: ConnectionInfo) {
    if(ci && ci.customData && ci.customData.clientId)
      await ConnectionMap.removeActiveConnection(ci.customData.clientId.toString())

      rc.isDebug() && rc.debug(rc.getName(this), 'providerFailed', ci)
      await this.connectionClosed(rc, ci)
    rc.finish(ci , null as any , null as any)
  }
  
  async providerClosed(rc: RunContextServer, ci: ConnectionInfo) {
    if(ci && ci.customData && ci.customData.clientId)
      await ConnectionMap.removeActiveConnection(ci.customData.clientId.toString())

    rc.isDebug() && rc.debug(rc.getName(this), 'providerClosed', ci)
    await this.connectionClosed(rc, ci)

    if(ci.protocol === Protocol.WEBSOCKET) {
      rc.finish(ci, null as any, null as any)
    }

    if(ci.provider) delete ci.provider
  }

  abstract connectionOpened(rc: RunContextServer, ci: ConnectionInfo, apiInfo: any): Promise<void>
  abstract connectionClosed(rc: RunContextServer, ci: ConnectionInfo): void

  async routeRequest(rc : RunContextServer,
                     ci : ConnectionInfo,
                     wo : WireObject) : Promise<WireReqResp> {
    
    let wResp : WireReqResp  = null as any
    const ir = {
      name    : wo.name,
      ts      : wo.ts + ci.msOffset,
      params  : wo.data
    } as InvocationData

    try {
      const reqStruct = this.apiMap[wo.name] 
      rc.isDebug() && rc.debug(rc.getName(this), 'Routing Request', wo, reqStruct)
      
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
        errorMessage : err.message,
        errorObject  : err.obj
      }

      wResp = new WireReqResp(wo.name, wo.ts, data, err.code || err.name, err.message, err.obj, err)
      await this.sendToProvider(rc, ci, wResp, ir)
    } finally {
      return wResp
    }
 }

  async routeEvent(rc : RunContextServer,
                   ci : ConnectionInfo,
                   wo : WireObject) : Promise<WireEventResp> {
    
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
      await this.sendEventResponse(rc, ci, wResp, ie)

    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), err)

      const data = {
        errorCode    : err.code || err.name,
        errorMessage : err.message,
        errorObject  : err.obj
      }

      wResp = new WireEventResp(wo.name, wo.ts, data, err.code || err.name, err.message, err.obj, err)
      await this.sendEventResponse(rc, ci, wResp, ie)
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
      rc.isError() && rc.error(rc.getName(this), err)
    }

    return true
  }

  closeConnection(rc : RunContextServer, ci : ConnectionInfo) {
    if(ci.provider) {
      ci.provider.requestClose(rc)
    } else {
      rc.isDebug() && rc.debug(rc.getName(this), 'Cannot close the connection as provider is closed.')
    }
  }

  async invokeXmnFunction(rc              : RunContextServer,
                          ci              : ConnectionInfo, 
                          invData         : InvocationData,
                          invStruct       : InvokeStruct,
                          isEvent         : boolean) {

    return await invStruct.executeFn(rc, ci, invData, invStruct, isEvent)
  }

  private async sendEventResponse(rc      : RunContextServer,
                                  ci      : ConnectionInfo,
                                  resp    : WireEventResp,
                                  invData : InvocationData ) {

    if (ci.lastEventTs < resp.ts) ci.lastEventTs = resp.ts // this is same as req.ts
    await this.sendToProvider(rc, ci, resp, invData)
  }

  private async sendToProvider(rc       : RunContextServer,
                               ci       : ConnectionInfo,
                               response : WireObject,
                               invData  : InvocationData | null) {

    if (ci.provider) {

      const ar = invData && this.piggyfrontMap.get(invData) || []
      if (invData && ar.length) this.piggyfrontMap.delete(invData)
      
      ar.push(response)

      invData && rc.isDebug() && rc.debug(rc.getName(this), 'sendToProvider', invData.name, ar)
      
      const err = (response as WireReqResp|WireEventResp).errorCode
      // Do not send piggy front events if error api execution fails
      await ci.provider.send(rc, err? [response] : ar)

    } else {
      rc.isStatus() && rc.status(rc.getName(this), 'Not sending response as provider is closed')
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

  public addToProviderCollection(rc       : RunContextServer,
                                 clientId : number,
                                 provider : XmnProvider) {

    // this.providerCollection.addActiveProvider(clientId, provider)
  }

  public getClientProvider(rc : RunContextServer, clientId : number) {
    // return this.providerCollection.getActiveProvider(clientId)
  }

  private logRegistration(rc      : RunContextServer,
                          apiName : string,
                          fnName  : string,
                          parent  : any,
                          isApi   : boolean) {

    // const pName  = rc.getName(parent),
    //       lpName = lo.lowerFirst(pName)

    // rc.debug(rc.getName(this), 'Registered', isApi ? 'api' : 'event', apiName ,  'like',
    //   parent[fnName] ? 
    //     (parent.prototype ? `'static ${pName}.${fnName}()'` : `'singleton ${lpName}.${fnName}()'`) : 
    //     `'new ${pName}().${fnName}()'`
    // )
  }

  public publishToEventQueue(rc : RunContextServer, eventObj : ClientEventObject) {
    rc.isStatus() && rc.status(rc.getName(this), 'Publishing event to event queue.', eventObj)

    const channel = EVENT_QUEUE + eventObj.workerId
    this.reqRedis.publish(channel, JSON.stringify(eventObj))
  }

  public async subscribeToEventQueueRedis(rc : RunContextServer, redisUrl : string, workerId : string) {
    const eventQueueChannel = EVENT_QUEUE + workerId,
          channelArr        = [eventQueueChannel]

    this.eventRedis = await RedisWrapper.connect(rc, 'evqRedis', redisUrl)

    rc.isStatus() && rc.status(rc.getName(this), 'Subscribing evqRedis to event queue channels.', channelArr)

    await this.eventRedis.subscribe(channelArr, async (ch : string, msg : string) => {
      if(ch === eventQueueChannel) {
        const eventObj = JSON.parse(msg) as ClientEventObject
        await this.processEventObject(rc, eventObj)
      }
    })
  }

  public async stopEventQueueSubscription() {
    await this.eventRedis.close()
  }

  private async processEventObject(refRc : RunContextServer, eventObj : ClientEventObject) {
    const rc = refRc.copyConstruct('', 'app-event')

    const co = await ConnectionMap.getActiveConnection(eventObj.connectionId)
    rc.isDebug() && rc.debug(rc.getName(this), 'Sending event to app?', eventObj, !!co)
    
    if(co) await rc.router.sendEvent(rc, co.ci, eventObj.eventName, eventObj.eventParams)
  }

  public getCookies(ci : ConnectionInfo) : Mubble.uObject<string> {

    if(ci.provider instanceof HttpsThirdServerProvider) {
      return ci.provider.getCookies()
    }

    return {}
  }

  public setCookies(ci : ConnectionInfo, cookies : Mubble.uObject<string>) {

    if(ci.provider instanceof HttpsThirdServerProvider) {
      return ci.provider.setCookies(cookies)
    }
  }

  public async redirectTo(rc : RunContextServer, ci : ConnectionInfo, url : string) {
    if(ci.provider instanceof HttpsThirdServerProvider) {
      return await ci.provider.redirect(rc, url)
    }

    throw new Error('Cannot redirect. Invalid provider.')
  }
}
