/*------------------------------------------------------------------------------
   About      : Utility functions for Master Module
   
   Created on : Fri Jun 02 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const LOG_ID = 'Master-Util'

export function concat(...args : any[]) : string {
  let buff : string = ''
  args.forEach((item : any)=>{
    buff += item + ' '
  })
  return buff
}

// assertion 
export function assert(assertion : boolean , ...errorMsg : any[]) : void {
  if(assertion) return

  const errStr : string = concat(...errorMsg)
  log(LOG_ID , errStr)
  throw(errStr)
}

// Util logging function

// short desc of master property
export function masterDesc(master: string , prop : string , value: any) : string {
  return `master:${master} property:${prop} value:${value}`
}
// Logging
export function log(logId : string , ...args : any[] ) : void {
  console.log(logId , ...args)
}

// type checking
export namespace MaType{
  
  export function isNumber(x: any): x is number {
      return typeof x === "number"
  }

  export function isString(x: any): x is string {
      return typeof x === "string"
  }
  
  export function isBoolean(x: any): x is boolean {
      return typeof x === "boolean"
  }

  export function isObject(x: any): x is object {
      return typeof x === "object"
  }

}



  
