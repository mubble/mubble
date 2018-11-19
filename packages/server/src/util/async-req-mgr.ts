/*------------------------------------------------------------------------------
   About      : Class for managing async request based on requests load

   This manager class make sure that more than maxParallelReqCount async request are not exucuted parallaly
   Useful in case of making http request. Ensuring that more than n http request of a type are not created
   Usecase scenerio : 
      1. Opencalaise server does not take more than 1 request simultaneously 
      2. Microsoft Azure server does not take more than 10 request per second
   
   Example use : 
   const asycMgr  = new AsyncReqManager(rc , 'AzureRequestManager' , 2)
   await asycMgr.makeRequest(rc , executeHttpResultResponse , this , rc , options)

   or 
   // adding n requests and wait till all of them finishes 
   
   asycMgr.makeRequest(rc , executeHttpResultResponse , this , rc , options1)
   asycMgr.makeRequest(rc , executeHttpResultResponse , this , rc , options2)
   asycMgr.makeRequest(rc , executeHttpResultResponse , this , rc , options3)
   await asycMgr.waitTillAllFinished()
   
   Created on : Thu Jul 20 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                                         from 'lodash'

import {RunContextServer}                              from '../rc-server'
import {executeHttpResultResponse}                     from './https-request'


export type NcAsyncReq = {id : string , reqTs : number , rc : RunContextServer , func : any  , args : any[] , resolve : (val : any) => void , reject : (val : any) => void }

export class AsyncReqManager {
  
  private static k : number = 0
  private static buff : string = 'ABCDEFGHIJKLKMNOPQRSTUVWXYZ'
  
  private requests  : NcAsyncReq [] = []
  private activeReqCount : number = 0
  private startTimeEntries : number [] = []
  private promiseArr : Promise<any> [] = []

  public constructor(private rc : RunContextServer , private name : string , private maxParallelReqCount : number , private load ?: {count : number , duration : number } ) {
    rc.isDebug() && rc.debug(rc.getName(this), 'AsyncReqManager created ',name , maxParallelReqCount , load)
  }

  public async makeRequest<T> (rc : RunContextServer , asyncFunc : (...args : any[] ) => Promise<T> , thisObj : any ,   ...funcArgs : any[] ) : Promise<T> {
    
    const now : number = Date.now(),
          len : number = AsyncReqManager.buff.length - 1 ,
          buff : string = AsyncReqManager.buff ,
          randStr : string = [buff[lo.random(len)],buff[lo.random(len)],buff[lo.random(len)]].join(''), 
          id : string = now + '-' + randStr + '-' +  AsyncReqManager.k++

    if(AsyncReqManager.k > 100000) AsyncReqManager.k = 0

    let req : NcAsyncReq = {id : id  , rc : rc , reqTs : now ,  args : funcArgs , func : asyncFunc.bind(thisObj) , resolve : null as any , reject : null as any }
    
    const pr : Promise<T> = new Promise<T> ((resolve : (val : T) => void , reject : (val : T) => void ) => {
        req.resolve = resolve
        req.reject = reject 
    })
    
    this.requests.push(req)
    this.promiseArr.push(pr)
    
    const startReq : NcAsyncReq = this.canStartRequest(rc)
    if(!startReq)
    {
      rc.isDebug() && rc.debug(rc.getName(this), 'can\'t start a request for now ack reqId', req.id , this.activeReqCount )
    }else{
      this.startRequest(startReq)
    }
    
    return pr
  }

  public async waitTillAllFinished(){
    await Promise.all(this.promiseArr)
    this.promiseArr = []
  }

  // Request load bandwidth logic.
  // classes can override this. ex : n per sec etc   
  public canStartRequest(rc : RunContextServer) : NcAsyncReq {
    
    if(this.requests.length && (this.maxParallelReqCount <= 0 ||  (this.activeReqCount < this.maxParallelReqCount)) ) {
      // check load 
      if(this.load){ 
        const dur = this.load.duration , 
              now = Date.now()
        // get all the startts entries in last n=dur seconds
        const lastReqs  = this.startTimeEntries.filter((ts) => { 
          return ts >= (now - dur*1000)
        })
        if(lastReqs.length >= this.load.count) {
          //rc.isDebug() && rc.debug(rc.getName(this), `load high ${lastReqs.length} >= ${this.load.count} request per ${dur} second ` )
          // check after half second
          setTimeout(()=>{this.startRequest(this.canStartRequest(this.rc))} , 500 )
          return null as any
        }
      }
      
      // we can start a new http request
      // take the first request
      const startReq = this.requests.shift()
      // we will not wait (await) for this async function
      return startReq as NcAsyncReq
    }

    return null as any
  }

  private async startRequest(req : NcAsyncReq ) {
    
    if(!req) return
    
      // using the same rc provided in the request to make sure that log goes in to correct session file
    const rc        : RunContextServer = req.rc ,
          startTime : number  = Date.now()
    
    // store this requests start time
    this.startTimeEntries.unshift(startTime)
    
    if(this.startTimeEntries.length > 100) this.startTimeEntries.splice(0,100)
    
    try{
    
      this.activeReqCount ++
    
      rc.isDebug() && rc.debug(rc.getName(this), 'starting the request ',req.id , this.activeReqCount)
      const res : any  = await req.func(...req.args)
    
      rc.isDebug() && rc.debug(rc.getName(this), 'request finished ',req.id , this.activeReqCount)
    
      this.finish(req , startTime , res , undefined )
    }catch(err){
    
      rc.isError() && rc.error(rc.getName(this), 'request failed' , req.id , err , this.activeReqCount)
      this.finish(req , startTime , undefined , err)
    }
    
  }
  
  private finish(req : NcAsyncReq  , startTime : number , resolvedValue : any , err : any ) {
    
    this.activeReqCount --
    
    // Add latecy information if the calling person needs it
    const latency : number = Date.now() - startTime
    if(resolvedValue && typeof(resolvedValue) === 'object' /*&& !Array.isArray(resolvedValue)*/){
      resolvedValue.latency = latency
    }

    const rc = req.rc
    
    rc.isDebug() && rc.debug(rc.getName(this), 'finish active request count ',this.activeReqCount)
    
    if(resolvedValue) req.resolve(resolvedValue)
    else req.reject(err)
    
    // start request from the que if any  
    this.startRequest(this.canStartRequest(rc))

  }

  public reset() {
    this.requests = []
    this.activeReqCount = 0
    this.startTimeEntries = []
    this.promiseArr = []
  }

}

