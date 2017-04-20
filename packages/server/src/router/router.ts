/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 13 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer, RUN_MODE} from '../util/rc-server'

import { XmnRouter, XmnResponse, 
         MubbleWebSocket, STATUS}  from '@mubble/core'

export class Router implements XmnRouter {

  private apiMap : Map<string, any> = new Map()

  constructor() {
    if (router) throw('Router is singleton. It cannot be instantiated again')
  }

  routeEvent(id: string, eventTs: number, data: object): void {

  }

  async routeRequest(api: string, data: object) {
    const obj = this.apiMap.get(api)
    if (obj) {
      return await obj[api].call(obj, data)
    }
    return {error: 'API_NOT_FOUND', data:{}}
  }

  registerApi(name: string, classObj: any, perm ?: string): void {
    this.apiMap.set(name, classObj)
  }

  xmnApi(obj : any, perm ?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    console.log('inside outer xmnApi', obj)
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      console.log('inside inner xmnApi', target, propertyKey)
      if (obj.constructor !== target.constructor) throw(new Error('The param must be an instance of the class'))
      router.registerApi(propertyKey, obj, perm)
    }
  }

}
export const router = new Router()


