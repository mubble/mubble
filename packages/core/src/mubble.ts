/*------------------------------------------------------------------------------
   About      : Common stuff for all Mubble Projects
   
   Created on : Wed Jul 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export namespace Mubble {

  export type uObject<T> = Object & {[name: string]: T}

  export const Lang = {
    English : 'en',
    Hindi   : 'hi',
    Kannada : 'kn'
  }

  export class uError extends Error {
    constructor(public code: string, msg: string) {
        super(msg)
    }
  }

  export class uPromise {

    private  fnResolve : (result: any) => any
    private  fnReject  : (err: Error)  => any
    readonly promise   : Promise<any>

    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.fnResolve = resolve
        this.fnReject  = reject
      })
    }

    resolve(result ?: any) {
      this.fnResolve(result)
    }

    reject(err: Error) {
      this.fnReject(err)
    }
  }
  
}