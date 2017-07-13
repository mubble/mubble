/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {RunContextServer} from '../rc-server'
import {XmnRouterServer}  from './xmn-router-server'

export enum PERM {PUBLIC, PUBLIC_ENC, SESSION, SYS_OP, SYS_ADMIN}

export interface XmnInfoBase {
  name      : string
  type      : any
}

export function xmnApi<T extends XmnInfoBase>(xmnType: { new () : T } ): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const xmnInfo = new xmnType ()
    XmnRegistry.enrollApi(propertyKey, target, xmnInfo)
  }
}

export function xmnEvent<T extends XmnInfoBase>(xmnType: { new () : T } ): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const xmnInfo = new xmnType ()
    XmnRegistry.enrollEvent(propertyKey, target, xmnInfo)
  }
}

export interface EnrollmentInfo {
  name      : string
  isApi     : boolean
  parent    : any
  xmnInfo   : XmnInfoBase
}

export class XmnRegistry {

  private static register: {[index: string]: EnrollmentInfo} = {}

  static enrollApi(name: string, parent: any, xmnInfo: XmnInfoBase) {

    if (this.register[name]) {
      const msg = `Duplicate definition for xmn api/event found: ${name}`
      console.error(msg)
      throw(Error(msg))
    }

    // console.log('enrolled api', api)
    this.register[name] = {name, isApi: true, parent, xmnInfo}
  }

  static enrollEvent(name: string, parent: any, xmnInfo: XmnInfoBase) {

    if (this.register[name]) {
      const msg = `Duplicate definition for xmn api/event found: ${name}`
      console.error(msg)
      throw(Error(msg))
    }

    // console.log('enrolled event', name)
    this.register[name] = {name, isApi: false, parent, xmnInfo}
  }

  static commitRegister(rc: RunContextServer, router: XmnRouterServer, providers: any[]) {

    providers.forEach(provider => {

      let providerUsed = false
       while (provider !== Function && provider !== Object) {
        if (this.checkForProvider(rc, router, provider)) providerUsed = true
        provider = provider.constructor
      }

      if (!providerUsed) {
        rc.isWarn() && rc.warn(rc.getName(this), rc.getName(provider), 'is not used, please remove')
      }
    })

    const pending = Object.keys(this.register)
    if (pending.length) {
        rc.isWarn() && rc.warn(rc.getName(this), pending, 'api/event are ignored as no providers are given for them')
    }
  }

  private static checkForProvider(rc: RunContextServer, router: XmnRouterServer, provider: any): boolean {

    let providerUsed = false

    for (const key in this.register) {

      if (!this.register.hasOwnProperty(key)) continue

      const eInfo = this.register[key]
      let match = false

      if (eInfo.parent.prototype) { // api is static function of a class
        if (provider.hasOwnProperty(key) && eInfo.parent === provider) match = true // direct
      } else { // api is member function, provider could be a class or instance of class
        if (provider.prototype) { // provider is a class
          if (provider.prototype.hasOwnProperty(key) && eInfo.parent === provider.prototype) match = true // class
        } else { // provider is an instance of some class
          if (provider[key] && eInfo.parent.constructor === provider.constructor) match = true // direct
        }
      }

      if (match) {
        if (eInfo.isApi) {
          router.registerApi(rc, key, provider, eInfo.xmnInfo)
        } else {
          router.registerEvent(rc, key, provider, eInfo.xmnInfo)
        }
        delete this.register[key]
        providerUsed = true
      }
    }
    return providerUsed
    
  }
}
