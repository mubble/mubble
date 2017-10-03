/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 21 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {RunContextServer} from '../rc-server'
import {XmnRouterServer}  from './xmn-router-server'

export interface EnrollmentInfo {
  name      : string
  isApi     : boolean
  parent    : any
  xmnInfo   : any
}

export class XmnRegistry {

  private static register: {[index: string]: EnrollmentInfo} = {}

  static enrollApi(name: string, parent: any, xmnInfo: any) {
    const apiName = xmnInfo.name
    //console.log(name , apiName)
    if (this.register[apiName]) {
      const msg = `Duplicate definition for xmn api/event found: ${name} ${JSON.stringify(this.register[name])}`
      console.error(msg)
      throw(Error(msg))
    }

    // console.log('enrolled api', api)
    this.register[apiName] = {name, isApi: true, parent, xmnInfo}
  }

  static enrollEvent(name: string, parent: any, xmnInfo: any) {
    const apiName = xmnInfo.name
    //console.log(name , apiName)
    if (this.register[apiName]) {
      const msg = `Duplicate definition for xmn api/event found: ${name} ${JSON.stringify(this.register[name])}`
      console.error(msg)
      throw(Error(msg))
    }

    // console.log('enrolled event', name)
    this.register[apiName] = {name, isApi: false, parent, xmnInfo}
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

      const eInfo = this.register[key],
            fnName = eInfo.name
      let match = false

      if (eInfo.parent.prototype) { // api is static function of a class
        if (provider.hasOwnProperty(fnName) && eInfo.parent === provider) match = true // direct
      } else { // api is member function, provider could be a class or instance of class
        if (provider.prototype) { // provider is a class
          if (provider.prototype.hasOwnProperty(fnName) && eInfo.parent === provider.prototype) match = true // class
        } else { // provider is an instance of some class
          if (provider[fnName] && eInfo.parent.constructor === provider.constructor) match = true // direct
        }
      }

      if (match) {
        if (eInfo.isApi) {
          router.registerApi(rc, fnName, provider, eInfo.xmnInfo)
        } else {
          router.registerEvent(rc, fnName, provider, eInfo.xmnInfo)
        }
        //console.log(key , this.register[key])
        delete this.register[key]
        providerUsed = true
      }
    }
    return providerUsed
    
  }
}
