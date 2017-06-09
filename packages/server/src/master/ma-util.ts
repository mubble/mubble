/*------------------------------------------------------------------------------
   About      : Utility functions for Master Module
   
   Created on : Fri Jun 02 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

import {StringValMap ,
        GenValMap }           from './ma-types'  

const LOG_ID = 'Master-Util'

export function concat(...args : any[]) : string {
  let buff : string = ''
  args.forEach((item : any)=>{
    buff += typeof(item)!=='object' ? item + ' ' : JSON.stringify(item) + ' '
  })
  return buff
}

export function throwError(...args : any[]){
  throw new Error(concat(...args))
}
// assertion 
export function assert(assertion : boolean , ...errorMsg : any[]) : void {
  if(assertion) return

  const errStr : string = concat(...errorMsg)
  logErr(LOG_ID , errStr)
  //log(LOG_ID , new Error().stack)
  throw(new Error(errStr))
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
export function logErr(logId : string , ...args : any[] ) : void {
  console.trace(logId , ...args)
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

  export function isNull(x: any): x is null   {
      return (x === null)
  }

}

export namespace FuncUtil {
  
  export async function sleep(ms : number) {
    await new Promise((resolve : any , reject : any) =>{
      setTimeout(()=>{
        resolve(ms)
      } , ms)
    })
  }

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

  // Object to map
  export function toMap<T>(obj : {[key : string] : T}) : Map<string , T> {
    const map : Map<string , T> = new Map()
    lo.forEach(obj , (value : T , key : string)=>{
      map.set(key , value)
    })
    return map
  }

 // Map to object
 export function toObject<T> (map : Map<string , T>) : {[key : string] : T} {
  const res : {[key : string] : T} = {}

  map.forEach((value : T , key : string)=>{
    res[key] = value
  })

  return res
 } 

 export function toParseObjectMap(srcObj : StringValMap) : GenValMap {
  return lo.mapValues(srcObj , (val : string)=>{
    return JSON.parse(val)
  })
 }

 export function toStringifyMap(srcObj : GenValMap) : StringValMap {
  return lo.mapValues(srcObj , (val : any)=>{
    return JSON.stringify(val)
  })
 }

}



  
