/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo            from 'lodash'
import {RunContextBase}     from '../rc-base'
import {IncomingEventBase, IncomingRequestBase} from './incoming-base'
import {XmnRegistry, PERM}  from './xmn-registry'

export interface ApiInfo {
  api       : string
  parent    : any
  perm      : PERM
}

export interface EventInfo {
  name      : string
  parent    : any
  perm      : PERM
}

export class XmnRouter {

  private apiMap   : {[index: string]: ApiInfo}   = {}
  private eventMap : {[index: string]: EventInfo} = {}

  constructor(rc      : RunContextBase, 
       private irb    : IncomingRequestBase,
       private ieb    : IncomingEventBase,
       ...providers   : any[]) {

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

  // Preferred way is to use @xmnApi
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

  getNewInRequest(): IncomingRequestBase {
    return this.irb.copyConstruct()
  }

  getNewInEvent(): IncomingEventBase {
    return this.ieb.copyConstruct()
  }

  async routeRequest(rc: RunContextBase, ir: IncomingRequestBase) {

    const apiInfo = this.apiMap[ir.api]
    if (!apiInfo) throw(Error(rc.error(rc.getName(this), 'Unknown api called', ir.api)))
    return this.invokeFn(rc, ir, apiInfo)
 }

  async routeEvent(rc: RunContextBase, ie: IncomingEventBase) {
    const eventInfo = this.eventMap[ie.name]
    if (!eventInfo) throw(Error(rc.error(rc.getName(this), 'Unknown event called', ie.name)))
    return this.invokeFn(rc, ie, eventInfo)
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

  private async invokeFn(rc: RunContextBase, ire: IncomingRequestBase | IncomingEventBase, info: any) {

    const parent = info.parent,
          name   = info.api || info.name

    let fn = parent[name]
    if (fn) return await fn.call(parent, rc, ire)

    const obj = new parent()
    return await obj[name].call(obj, rc, ire)
  }
}