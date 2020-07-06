/*------------------------------------------------------------------------------
   About      : Common stuff for all Mubble Projects
   
   Created on : Wed Jul 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export namespace Mubble {

  export type uObject<T> = Object & {[name: string]: T}

  /* An object which has (optional) fields of the given type. 
    Useful as datastore update Object of given type 
  */
  export type uChildObject<T> = {[name in keyof T] ?: T[name]}

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

    static execFn(fn: Function, context: Object | null, ...params: any[]) : Promise<any> {
      const promiseFn = this.getFn(fn, context)
      return promiseFn(...params)
    }
  
    static delayedPromise<X>(ms: number, fulfillWith ?: X): Promise<X> {
      return new Promise((resolve : any, reject : any) => {
        setTimeout(() => resolve(fulfillWith), ms)
      })
    }

    private static getFn(fn: Function, context: Object | null): (...arParam: any[]) => Promise<any> {

      return function(...arParam: any[]): Promise<any> {
        
        return new Promise( function(resolve : any, reject : any) {
          
          function cb(...arCbParam: any[]) {
            
            const err = arCbParam.shift()
            if (err) return reject(err)
            // Resolved with multiple values; this would actually give first value in promise
            resolve.apply(null, arCbParam)
          }
          
          try {
            arParam.push(cb)
            fn.apply(context, arParam)
          } catch (e) {
            reject(e)
          }
        })
      }
    }

    private  fnResolve : null | ((result: any) => any)
    private  fnReject  : null | ((err: Error)  => any)
    private  fulfilled : boolean
    readonly promise   : Promise<T>

    constructor() {
      this.promise = new Promise<T>((resolve, reject) => {
        this.fnResolve = resolve
        this.fnReject  = reject
        this.fulfilled = false
      })
    }

    // Executes a function sync and return promise for chaining
    execute(cb: (promise: uPromise<T>) => void): uPromise<T> {
      cb(this)
      return this
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

    isFulfilled() : boolean {
      return this.fulfilled
    }

    private cleanup() {
      this.fnResolve = null
      this.fnReject  = null
      this.fulfilled = true
    }
  }
  
}