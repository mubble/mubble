/*------------------------------------------------------------------------------
   About      : Class for managing async request based on load

   This manager class make sure that more than maxParallelReqCount async request are not exucuted parallaly
   Useful in case of making http request. Ensuring that more than n http request of a type are not created
   Usecase scenerio : 
      1. Opencalaise server does not take more than 1 request simultaneously 
      2. Microsoft Azure server does not take more than 10 request per second
   
   Example use : 
   const asycMgr  = new AsyncReqManager(rc , 'AzureRequestManager' , 2)
   await asycMgr.makeRequest(rc , executeHttpResultResponse , this , rc , options)
   
   Created on : Thu Jul 20 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                                         from 'lodash'

import {RunContextServer}                              from '../rc-server'
import {executeHttpResultResponse}                     from './https-request'


export type NcAsyncReq = {id : string , reqTs : number , rc : RunContextServer , func : any  , args : any[] , resolve : (val : any) => void , reject : (val : any) => void , running : boolean }

export class AsyncReqManager {
  
  private requests  : NcAsyncReq [] = []
  private activeReqCount : number = 0
  private static k : number = 0
  private static buff : string = 'ABCDEFGHIJKLKMNOPQRSTUVWXYZ'

  public constructor(rc : RunContextServer , private name : string , private maxParallelReqCount : number , private load ?: {count : number , duration : number } ) {
    rc.isDebug() && rc.debug(rc.getName(this), 'AsyncReqManager created ',name , maxParallelReqCount , load)
  }

  
  public async makeRequest<T> (rc : RunContextServer , asyncFunc : (...args : any[] ) => Promise<T> , thisObj : any ,   ...funcArgs : any[] ) : Promise<T> {
    
    const now : number = Date.now(),
          len : number = AsyncReqManager.buff.length - 1 ,
          buff : string = AsyncReqManager.buff ,
          randStr : string = [buff[lo.random(len)],buff[lo.random(len)],buff[lo.random(len)]].join(''), 
          id : string = now + '-' + randStr + '-' +  AsyncReqManager.k++

    if(AsyncReqManager.k > 100000) AsyncReqManager.k = 0

    let req : NcAsyncReq = {id : id  , rc : rc , reqTs : now ,  args : funcArgs , running : false ,  func : asyncFunc.bind(thisObj) , resolve : null as any , reject : null as any }
    
    const pr : Promise<T> = new Promise<T> ((resolve : (val : T) => void , reject : (val : T) => void ) => {
        req.resolve = resolve
        req.reject = reject 
    })
    
    this.requests.push(req)
    
    const startReq : NcAsyncReq = this.canStartRequest()
    if(!startReq)
    {
      rc.isDebug() && rc.debug(rc.getName(this), 'can\'t start a request for now ack reqId', req.id , this.activeReqCount )
    }else{
      this.startRequest(startReq)
    }

    return pr
  }

  // Request load bandwidth logic.
  // classes can override this. ex : n per sec etc   
  public canStartRequest() : NcAsyncReq {
    
    const pendingReq : NcAsyncReq [] = this.requests.filter((val)=>!val.running)
    if(pendingReq.length && this.activeReqCount < this.maxParallelReqCount) {
      // we can start a new http request
      // take the first non running  request
      const startReq = pendingReq[0]
      if(!startReq) throw Error('start Request not found in req que')
      // we will not wait (await) for this async function
      return startReq
    }

    return null as any
  }

  private async startRequest(req : NcAsyncReq ) {
    
    if(!req) return
    
      // using the same rc provided in the request to make sure that log goes in to correct session file
    const rc        : RunContextServer = req.rc ,
          startTime : number  = Date.now()
    
    try{
      
      this.activeReqCount ++
      req.running = true
      
      rc.isDebug() && rc.debug(rc.getName(this), 'starting the request ',req.id , this.activeReqCount)
      const res : any  = await req.func(...req.args)
      
      rc.isDebug() && rc.debug(rc.getName(this), 'request finished ',req.id , this.activeReqCount)
      
      this.finish(req.id , startTime , res , undefined )
    }catch(err){
      
      rc.isError() && rc.error(rc.getName(this), 'request failed' , req.id , err , this.activeReqCount)
      this.finish(req.id , startTime , undefined , err)
      
    }
    
  }
  
  private finish(id : string , startTime : number , resolvedValue : any , err : any ) {
    
    this.activeReqCount --
    
    // Add latecy information if the calling person needs it
    const latency : number = Date.now() - startTime
    if(resolvedValue && typeof(resolvedValue) === 'object' /*&& !Array.isArray(resolvedValue)*/){
      resolvedValue.latency = latency
    }

    // find the request with running true and given ts
    const reqIndex : number = this.requests.findIndex((val)=>{
      return val.id === id
    })
    
    if(reqIndex === -1){
      throw Error('Request id '+ id + 'not found in queue')
    }
    
    const req = this.requests[reqIndex] ,
          rc = req.rc
    
    // Remove this req from queue
    this.requests.splice(reqIndex , 1)
    
    rc.isDebug() && rc.debug(rc.getName(this), 'finish active request count ',this.activeReqCount)
    
    if(resolvedValue) req.resolve(resolvedValue)
    else req.reject(err)

    this.startRequest(this.canStartRequest())

  }

}

