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

  export class uPromise<T> {

    private  fnResolve : null | ((result: any) => any)
    private  fnReject  : null | ((err: Error)  => any)
    readonly promise   : Promise<T>

    constructor() {
      this.promise = new Promise<T>((resolve, reject) => {
        this.fnResolve = resolve
        this.fnReject  = reject
      })
    }

    resolve(result : T) {
      if (this.fnResolve) {
        this.fnResolve(result)
        this.cleanup()
      }
    }

    reject(err: Error) {
      if (this.fnReject) {
        this.fnReject(err)
        this.cleanup()
      }
    }

    private cleanup() {
      this.fnResolve = null
      this.fnReject  = null
    }
  }
  
}