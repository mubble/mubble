/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo              from 'lodash'
import {RunContextBase}     from '../rc-base'
import {XmnRegistry, PERM}  from './xmn-registry'

export enum Protocol {HTTP, WEBSOCKET, HTTPS}

export interface IncomingConnectionBase {

  ip          : string
  protocol    : Protocol
  host        : string
  port        : number
  url         : string // /api/getTopics
  headers     : object

  appName     : string
  channel     : string
  appVersion  : string
  jsVersion   : string
}

export interface IncomingRequestBase {

  api         : string
  param       : object
  startTs     : number
}

export interface IncomingEventBase {

  name        : string
  param       : object
  startTs     : number
}

interface ApiInfo {
  api       : string
  parent    : any
  perm      : PERM
}

interface EventInfo {
  name      : string
  parent    : any
  perm      : PERM
}

export abstract class XmnRouter {

  /**
   * This api is called when a new connection arrives for websocket or http(s)
   * You should extend the IncomingConnectionBase and return that. This would 
   * helps you in keeping the extra information that you wish to associate with a connection
   * 
   * In case of http(s) all the data is taken from IncomingConnectionBase.headers
   * For WebSockets: The requested name-value pairs are put in a synthetically created IncomingConnectionBase.headers 
   * 
   * @param rc 
   * @param inConnection Base connection to extend
   */
  abstract beforeConnect(rc           : RunContextBase, 
                         inConnection : IncomingConnectionBase) : IncomingConnectionBase

  /**
   * Called before executing a request api (pre-hook)
   * @param rc 
   * @param inConnection  : Incoming connection
   * @param inRequest     : Request object to be extended and returned
   */
  abstract beforeRequest(rc           : RunContextBase, 
                         inConnection : IncomingConnectionBase, 
                         inRequest    : IncomingRequestBase)  : IncomingRequestBase

  /**
   * Called after successfully executing a request api (post-hook)
   * @param rc 
   * @param inConnection : Incoming connection
   * @param inRequest    : Incoming request
   * @param outResponse  : Last chance to modify the response
   */
  abstract afterRequest (rc           : RunContextBase, 
                         inConnection : IncomingConnectionBase, 
                         inRequest    : IncomingRequestBase,
                         outResponse  : object)               : object
  
  /**
   * Called before executing a event api (pre-hook)
   * @param rc 
   * @param inConnection : Incoming connection
   * @param inEvent      : Incoming event object to be extended
   */
  abstract beforeEvent  (rc           : RunContextBase, 
                         inConnection : IncomingConnectionBase, 
                         inEvent    : IncomingEventBase)      : IncomingEventBase


/*------------------------------------------------------------------------------
  Router logic finalized: do not extend                       
------------------------------------------------------------------------------*/

  private apiMap   : {[index: string]: ApiInfo}   = {}
  private eventMap : {[index: string]: EventInfo} = {}

  constructor(rc: RunContextBase, ...providers: any[]) {
    XmnRegistry.commitRegister(rc, this, providers)   
  }

  // Preferred way is to use @xmnApi
  registerApi(rc: RunContextBase, api: string, parent: any, perm: PERM): void {

    if (this.apiMap[api]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate api:' + api)))
    }
    if (parent[api] || (parent.prototype && parent.prototype[api])) {
      if (rc.isDebug()) this.logRegistration(rc, api, parent, true)
      this.apiMap[api] = {api, parent, perm}
    } else {
      throw(Error(rc.error(rc.getName(this), 'api', api, 'does not exit in', rc.getName(parent))))
    }
  }

  // Preferred way is to use @xmnEvent
  registerEvent(rc: RunContextBase, name: string, parent: any, perm: PERM): void {
    if (this.eventMap[name]) {
      throw(Error(rc.error(rc.getName(this), 'Duplicate event:' + name)))
    }
    if (parent[name] || (parent.prototype && parent.prototype[name])) {
      if (rc.isDebug()) this.logRegistration(rc, name, parent, false)
      this.eventMap[name] = {name, parent, perm}
    } else {
      throw(Error(rc.error(rc.getName(this), 'event', name, 'does not exit in', rc.getName(parent))))
    }
  }

  async routeRequest(rc: RunContextBase, ic : IncomingConnectionBase, ir: IncomingRequestBase) {

    const apiInfo = this.apiMap[ir.api]
    if (!apiInfo) throw(Error(rc.error(rc.getName(this), 'Unknown api called', ir.api)))

    const serverIr = await this.beforeRequest(rc, ic, ir),
          response = await this.invokeFn(rc, ic, ir, apiInfo)

    return await this.afterRequest(rc, ic, serverIr, response)
 }

  async routeEvent(rc: RunContextBase, ic : IncomingConnectionBase, ie: IncomingEventBase) {
    const eventInfo = this.eventMap[ie.name]
    if (!eventInfo) throw(Error(rc.error(rc.getName(this), 'Unknown event called', ie.name)))

    const serverIe = await this.beforeEvent(rc, ic, ie)
    return await this.invokeFn(rc, ic, ie, eventInfo)
  }

  private logRegistration(rc: RunContextBase, name: string, parent: any, isApi: boolean) {

    const pName  = rc.getName(parent),
          lpName = lo.lowerFirst(pName)

    rc.debug(rc.getName(this), 'Registered', isApi ? 'api' : 'event',  'like',
      parent[name] ? 
        (parent.prototype ? `'static ${pName}.${name}()'` : `'singleton ${lpName}.${name}()'`) : 
        `'new ${pName}().${name}()'`
    )
  }

  private async invokeFn(rc   : RunContextBase, 
                         ic   : IncomingConnectionBase, 
                         ire  : IncomingRequestBase | IncomingEventBase, 
                         info : any) {

    const parent = info.parent,
          name   = info.api || info.name

    let fn = parent[name]
    if (fn) return await fn.call(parent, rc, ic, ire)

    const obj = new parent()
    return await obj[name].call(obj, rc, ic, ire)
  }
}