/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Apr 09 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/



export function getFn(fn: any, context: any): (...arParam: any[]) => Promise<any> {

  return function(...arParam: any[]): Promise<any> {
    
    return new Promise( function(resolve : any, reject : any) {
      
      function cb(...arCbParam: any[]) {
        
        const err = arCbParam.shift()
            
        if (err) return reject(err)
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

export function execFn(fn: any, context: any, ...params: any[]) : Promise<any> {
  const promiseFn = getFn(fn, context)
  return promiseFn(...params)
}

export function delayedPromise(ms: number, fulfillWith ?: any): Promise<any> {
  return new Promise( function(resolve : any, reject : any) {
    setTimeout(ms, function() {
      resolve(fulfillWith)
    })
  })
}