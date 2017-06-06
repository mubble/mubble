/*------------------------------------------------------------------------------
   About      : Manager class for master data (upload / sync)
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'

import {RedisWrapper}         from './redis-wrapper'
import {MasterBase}           from './ma-base'
import {RunContextServer}     from '../rc-server'



export type masterdatainfo = {
  mastername : string 
  masterdata : string
}

export type syncInfo = {
  ts : number 
  // add more
}

/**
 * In Memory cache used to store store data for each master
 */
export class MasterData {
  
  public constructor(public mastername : string) {

  }

  public records    : object [] = []
  public modTSField : string

  public getMaxTS() : number {
    return 0
  } 
  public getMinTS() : number {
    return 0
  }

  public refTS          : number
  public lastUpdateTS   : number

}

export class SourceSyncData {
  
  mastername : string
  source     : any []
  redisData  : any []
  
 
  inserts    : {pk : string , obj : any} [] = []
  updates    : {pk : string , obj : any} [] = []
  modifyTS   : number = lo.now()

  public constructor(master : string , source : any [] , target : any[] ) {
    this.mastername = master
    this.source = source
    this.redisData = target
  }

}

export class MasterMgr {
  
  mredis : RedisWrapper 
  sredis : RedisWrapper

  masterCache : Map<string , MasterData>


  public async init(rc : RunContextServer) : Promise<any> {
      
      //  setup mredis (connect)
      //  setup sredis (connect)
      //  mredis and sredis data sync verify
      //  sredis subscribe to events master changes
      //  setup auto refresh 
      //  build cache from sredis
      
  }
  
  //async applyMasterData (rc : RunContextServer , data : Array<masterdatainfo> ) : Promise<any>
  
  public async applyFileData(context : RunContextServer , arModels : {master : string , source: string} []) {
    
  }

  // Used for all source sync apis (partial , full , multi)
  public async applyJsonData(context : RunContextServer ,  modelName : string , jsonRecords : Array<object> , redisRecords : Array<object> ) {

  }

  // 
  public destinationSync (rc : RunContextServer , sync : Array<syncInfo> ) {
      // Get destSynFields from Registry
  }


  // Update the mredis with required changes 
  private async applyData(context : RunContextServer , data : SourceSyncData[] ) {

  }

  private async buildInMemoryCache() {

  }

  // hash get functions 
  async hget (key : string , field : string) : Promise<object> {
    
    // Just for compilation
    const params = [key , field]
    const redis : RedisWrapper = this.mredis
    const res : any = await redis.redisCommand().hget(params)
    return Promise.resolve(res)
  }
  
  async hmget(key : string , fields : string[]) : Promise<Array<object>> {
    
    const params = [key].concat(fields)
    const redis : RedisWrapper = this.mredis
    const res : any[] = await redis.redisCommand().hmget(params)

    return Promise.resolve(res.map(item => {
      return JSON.parse(item)
    }))
  }


  async hgetall(key : string) : Promise< Array<object> > {
    
    const params = [key]
    const redis : RedisWrapper = this.mredis
    const res : any[] = await redis.redisCommand().hgetall(params)

    return Promise.resolve(res.map(item => {
      return JSON.parse(item)
    }))
  }

  //hash set functions
  async hset<T extends MasterBase>(key : string , item : T) {
    const params = [key].concat([JSON.stringify(item.getId()) , JSON.stringify(item) ])
    const redis : RedisWrapper = this.mredis
    
    return redis.redisCommand().hset(params)
  }

  async hmset<T extends MasterBase>(key : string , items : T[]) {
    const params = [key]
    for(const item of items){
      params.push(JSON.stringify(item.getId()) , JSON.stringify(item))
    }
    
    const redis : RedisWrapper = this.mredis
    return redis.redisCommand().hmset(params)
  }

}
