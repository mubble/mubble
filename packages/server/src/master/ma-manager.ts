/*------------------------------------------------------------------------------
   About      : Manager class for master data (upload / sync)
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import * as crypto            from 'crypto'


import {RedisWrapper}         from './redis-wrapper'
import {MasterBase}           from './ma-base'
import {RunContextServer}     from '../rc-server'
import {masterDesc , assert , 
        concat , log ,
        maArrayMap , MaType}  from './ma-util'
        
import {ModelConfig}          from './ma-model-config'             
import {MasterRegistry}       from './ma-registry'             
import {MasterRegistryMgr}    from './ma-reg-manager'
import {StringValMap , 
        GenValMap}            from './ma-types'              

const LOG_ID : string = 'MasterMgr'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

var CONST = {
  REDIS_NS          : 'master:',
  REDIS_TS_SET      : 'ts:',      // example 'master:ts:operator'
  REDIS_DATA_HASH   : 'data:',    // example 'master:data:operator'
  REDIS_DIGEST_KEY  : 'digest',   // key for digest hash
  REDIS_CHANNEL     : 'master:updates',

  DIGEST_REMOTE     : 'remote' ,
  
  // Redis Commands options consts
  WITHSCORES        : 'WITHSCORES' ,
  MINUS_INFINITY    : '-inf' ,
  PLUS_INFINITY     : '+inf' 
}


/*
export function getMapObj<T> () : any {
  const t : any = typeof  {[key: string] : T} 
}*/

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
  redisData  : GenValMap
  
 
  inserts    : Map<string , any> = new Map<string , any>()
  updates    : Map<string , any> = new Map<string , any>()

  modifyTS   : number = lo.now()

  public constructor(master : string , source : any [] , target : GenValMap ) {
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
  
  public async applyFileData(context : RunContextServer , arModels : {master : string , source: string} []) /*: {name : string , error:string} []*/ {
    
    const result : {name : string , error:string} [] = []
    
    const ssdArr : SourceSyncData[] = [] ,
          digestKey : string = CONST.REDIS_NS + CONST.REDIS_DIGEST_KEY ,
          digestMap : {[key:string] : string} =  await this.hgetall(digestKey) 

    for(let i : number = 0 ; i <arModels.length ; i++ ){
      const oModel : {master : string , source: string} = arModels[i] 
      MasterRegistryMgr.isAllowedFileUpload(oModel.master.toLowerCase())

      const master  : string              = oModel.master.toLowerCase() ,
            mDigest : string              = digestMap[master] ,
            fDigest : string              = crypto.createHash('md5').update(oModel.source).digest('hex') , 
            json    : object              = JSON.parse(oModel.source)

     assert(Array.isArray(json) , 'master ',master , 'file upload is not an Array')       
     
     if(lo.isEqual(mDigest , fDigest)){
        result.push({name : master , error : 'skipping as file is unchanged'}) 
        return
     }

     const redisData : GenValMap = await this.listAllMasterData(context , master) ,
           ssd  : SourceSyncData = MasterRegistryMgr.validateBeforeSourceSync(context , master , json as Array<object> , redisData )       
      
      
    }

    
    return Promise.resolve(result)
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
    const res : any = await redis.redisCommand().hget(key , field)
    return Promise.resolve(res)
  }
  
  async hmget(key : string , fields : string[]) : Promise<Array<object>> {
    
    const redis : RedisWrapper = this.mredis
    const res : any[] = await redis.redisCommand().hmget(key , ...fields)

    return Promise.resolve(res.map(item => {
      return JSON.parse(item)
    }))
  }


  async hgetall(key : string) {
    
    const redis : RedisWrapper = this.mredis
    return await redis.redisCommand().hgetall(key)
  }

  //hash set functions
  async hset<T extends MasterBase>(key : string , item : T) {
    const params = [key].concat([JSON.stringify(item.getId()) , JSON.stringify(item) ])
    const redis : RedisWrapper = this.mredis
    
    return redis.redisCommand().hset(key , JSON.stringify(item.getId()) , JSON.stringify(item) )
  }

  async hmset<T extends MasterBase>(key : string , items : T[]) {
    const params = []
    for(const item of items){
      params.push(JSON.stringify(item.getId()) , JSON.stringify(item))
    }
    
    const redis : RedisWrapper = this.mredis
    return redis.redisCommand().hmset(key , ...params)
  }

  
  public async listAllMasterData(rc : RunContextServer , master : string) : Promise<any> {
    const masterKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master
    const map : StringValMap =  await this.mredis.redisCommand().hgetall(masterKey)
    
    return Promise.resolve(lo.mapValues(map , (val : string)=>{
      return JSON.parse(val)
    }))
  }

  public async _getLatestRec(redis : RedisWrapper , master : string)  {
    

    return Promise.resolve({key : 'key1' , ts: 1234})
  }

}
