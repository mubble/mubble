/*------------------------------------------------------------------------------
   About      : Utility functions for Master Module
   
   Created on : Fri Jun 02 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

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

export namespace FuncUtil {
  
  // create a map from array based on mapping function for each item
  export function maArrayMap<T> (arr : T[] , mapFn : (rec : T) => {key : string , value : T} ) : {[key : string] : T} {
    
    const res : {[key : string] : T} = {}
    arr.forEach((item : T)=> {
      const val : {key : string , value : T} = mapFn(item)
      res[val.key] = val.value
    })
    return res
  } 
  
  /**
   * Select only those properties from a object which satisfy the criteria 
   */
  export function reduce<T>(obj : {[key : string] : T} , reduceFn : (value : T , key ?: string) => boolean ) : {[key : string] : T} {
    
    return lo.reduce(obj , (memo : {[key : string] : T} , value : T, key : string ) : {} => {
      // If key value pairs satisfy the condition
      // set them in result function
      if(reduceFn(value , key)) memo[key] = value
      return memo
    } , {}  )

  }

  export function toMap<T>(obj : {[key : string] : T}) : Map<string , T> {
    const map : Map<string , T> = new Map()
    lo.forEach(obj , (value : T , key : string)=>{
      map.set(key , value)
    })
    return map
  }


}



  
