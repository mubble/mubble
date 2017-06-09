/*------------------------------------------------------------------------------
   About      : Manager class for master data (upload / sync)
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import * as crypto            from 'crypto'

import {Multi}                from 'redis'

import {RedisWrapper}         from '../cache/redis-wrapper'
import {MasterBase}           from './ma-base'
import {RunContextServer}     from '../rc-server'
import {masterDesc , assert , 
        concat , log ,
        MaType ,
        FuncUtil }            from './ma-util'
        
import {ModelConfig}          from './ma-model-config'             
import {MasterRegistry}       from './ma-registry'             
import {MasterRegistryMgr}    from './ma-reg-manager'
import {StringValMap , 
        GenValMap , 
       MasterCache }          from './ma-types'              

const LOG_ID : string = 'MasterMgr'
function MaMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}
function debug(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

var CONST = {
  REDIS_NS          : 'ncmaster:',
  REDIS_TS_SET      : 'ts:',      // example 'master:ts:operator'
  REDIS_DATA_HASH   : 'data:',    // example 'master:data:operator'
  REDIS_DIGEST_KEY  : 'digest',   // key for digest hash
  REDIS_CHANNEL     : 'ncmaster:updates',

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
  source     : Map<string , any>
  redisData  : GenValMap
  
 
  inserts    : Map<string , any> = new Map<string , any>()
  updates    : Map<string , any> = new Map<string , any>()
  deletes    : Map<string , any> = new Map<string , any>()


  modifyTs   : number = lo.now()

  public constructor(master : string , source : Map<string , any> , target : GenValMap , now : number ) {
    this.mastername = master
    this.source = source
    this.redisData = target
    this.modifyTs = now
  }

}

export class MasterMgr {
  
  mredis : RedisWrapper 
  sredis : RedisWrapper
  // sredis for subscription
  // pub & sub need to have a seprate connection
  // sub redis can only issue limited commands
  subRedis : RedisWrapper

  masterCache : Map<string , MasterData>
  rc : RunContextServer

  /*
  Actions : 
  0. MasterRegistry init. Verify all master registries
  1. redis wrapper init
  2. setup mredis (connect)
  3. setup sredis (connect)
  4. mredis and sredis data sync verify
  5. sredis subscribe to events master changes
  6. xxx setup auto refresh 
  7. build cache from sredis
  */

  public async init(rc : RunContextServer) : Promise<any> {
      
      this.rc = rc

      MasterRegistryMgr.init(rc)
      // Init the redis wrapper
      RedisWrapper.init(rc)
      
      // Todo : take these values from config / rc
      const mredisUrl : string = 'redis://localhost:13107'
      const sredisUrl : string = 'redis://localhost:25128'
      
      this.mredis = await RedisWrapper.connect(rc , 'MasterRedis' , mredisUrl )
      this.sredis = await RedisWrapper.connect(rc , 'SlaveRedis' , sredisUrl )
      this.subRedis = await RedisWrapper.connect(rc , 'SubscriptionRedis' , sredisUrl )
      
      assert(this.mredis.isMaster() && this.sredis.isSlave() , 'mRedis & sRedis are not master slave' , mredisUrl , sredisUrl)
      
      await this.checkSlaveMasterSync(false)

      await this.setSubscriptions()

      await this.buildInMemoryCache()
  }

  async checkSlaveMasterSync(assertCheck : boolean) : Promise<any> {
    type ts_info =  {key ?: string , ts ?: number}
    
    MaMgrLog('checkSlaveMasterSync started')
    for(const master of MasterRegistryMgr.masterList()){
      
      const mDetail : ts_info = await MasterMgr._getLatestRec(this.mredis , master)
      const sDetail : ts_info = await MasterMgr._getLatestRec(this.sredis , master)
      if(lo.isEmpty(mDetail) && lo.isEmpty(sDetail)){
        MaMgrLog('Master Slave Sync No records for master',master)
      }
      else if(!lo.isEqual(mDetail , sDetail) ){
        // should not happen
        if(assertCheck) assert(false , 'master slave data sync mismatch', mDetail , sDetail)
        
        MaMgrLog('Master-Slave sync mismatch for' , mDetail , sDetail , master , 'will wait for 15 seconds')
        await FuncUtil.sleep(15*1000)
        return this.checkSlaveMasterSync(false)
      }
      MaMgrLog('Master Slave Sync', mDetail , master)
    }

    MaMgrLog('checkSlaveMasterSync finished')
  }

  // sRedis subscribing to master publish records
  async setSubscriptions() {
    MaMgrLog("Subscribing sredis to master ",CONST.REDIS_CHANNEL)
    
    await this.subRedis.subscribe([CONST.REDIS_CHANNEL] , (channel : string , msg : string)=>{
      MaMgrLog('Sredis','on', channel, 'channel received message', msg)
      const masters : string[] = JSON.parse(msg) as string[]
      assert(Array.isArray(masters) , 'invalid masters array received ',msg)

      this.refreshSelectModels(masters)

    })
  }

  async refreshSelectModels(masters : string[]) {
    MaMgrLog('refreshing masters list',masters)
    const all : string[] = MasterRegistryMgr.masterList()
    masters.forEach((mas : string)=>{
      assert(all.indexOf(mas)!==-1 , 'Invalid Master Obtained from Publish',mas , masters)
    })

    for(const mas of masters){
      await this.refreshAModel(mas)
    }
  }

  async refreshAModel(mastername : string) {
    MaMgrLog('refreshing master', mastername)

    const redis : RedisWrapper = this.sredis ,
          redisTsKey : string  = CONST.REDIS_NS + CONST.REDIS_TS_SET + mastername ,
          redisDataKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + mastername ,
          lastTs   : number  = 0 , // Todo get from store
          resultWithTsScore : string [] = await redis.rwZrangebyscore(redisTsKey , lastTs , CONST.PLUS_INFINITY, true) ,
          resultKeys :string [] = resultWithTsScore.filter((val : any , index : number)=>{ return index%2 ===0 })

    if(!resultKeys.length){
      MaMgrLog('refreshAModel no records to update')
      return
    }
    MaMgrLog('refreshAModel info', {mastername , lastTs } , resultKeys.length , resultKeys)

    const recs : string[] = await redis.redisCommand().hmget(redisDataKey , ...resultKeys)
    MaMgrLog('refreshAModel ',mastername , 'refreshed records:',recs.length /*, recs*/)
    // todo : Data store Impl
  }
  
  public async applyFileData(rc : RunContextServer , arModels : {master : string , source: string} []) {
    
    const results : object [] = []
    
    const digestKey   : string = CONST.REDIS_NS + CONST.REDIS_DIGEST_KEY ,
          digestMap   : {[key:string] : string} =  await this.mredis.redisCommand().hgetall(digestKey) ,
          masterCache : MasterCache = {} ,
          todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string}} = {},
          // all masters update records will have same timestamp
          now         : number = lo.now()
    
    debug('digestMap:',digestMap)     
    
    for(let i : number = 0 ; i <arModels.length ; i++ ){
      
      const oModel : {master : string , source: string} = arModels[i] 
      MasterRegistryMgr.isAllowedFileUpload(oModel.master.toLowerCase())
      
      const master  : string              = oModel.master.toLowerCase() ,
            //testing remove that
            mDigest : string              = digestMap ? digestMap[master] : '' ,
            json    : object              = JSON.parse(oModel.source),
            fDigest : string              = crypto.createHash('md5').update(JSON.stringify(json) /*oModel.source*/).digest('hex')
            
     assert(Array.isArray(json) , 'master ',master , 'file upload is not an Array')       
     debug(master , 'mDigest:',mDigest , 'fDigest:',fDigest)
     if(lo.isEqual(mDigest , fDigest)){
        results.push({name : master , error : 'skipping as file is unchanged'}) 
        continue
     }

     const redisData : GenValMap = await this.listAllMasterData(rc , master) ,
           ssd  : SourceSyncData = MasterRegistryMgr.validateBeforeSourceSync(rc , master , json as Array<object> , redisData , now )       
     
     MaMgrLog('applyFileData' , master ,'inserts:' ,ssd.inserts.size ,'updates:', ssd.updates.size , 'deletes:',ssd.deletes.size )
     this.setParentMapData(master , masterCache , ssd) 
     todoModelz[master] = {ssd : ssd , fDigest : fDigest} 

     //debug('todoModelz',master, ssd.inserts.size , ssd.updates.size , ssd.deletes.size )    
    }

    if(lo.size(todoModelz)) await this.applyData(rc , results , masterCache , todoModelz)
    MaMgrLog('applyData' , 'results',results)
  }

  private setParentMapData(master : string , masterCache : MasterCache , ssd : SourceSyncData) : void {
     
     // master dependency data settings      
     if((lo.hasIn(masterCache , master) && masterCache[master] )){
        const depMap : Map<string , any> = masterCache[master]
        MaMgrLog(master , 'overriding source ',  depMap.size , ssd.source.size )
        masterCache[master] = ssd.source
     }else{
       masterCache[master] = ssd.source
       MaMgrLog('setParentMapData' , master , 'source size' , ssd.source.size )
     }
     
     if(lo.hasIn( MasterRegistryMgr.dependencyMap , master)){
       const depMasters : string [] = MasterRegistryMgr.dependencyMap[master]
       depMasters.forEach((depMas : string)=>{
         if(!lo.hasIn(masterCache ,depMas)) masterCache[depMas] = null as any as Map<string , any>
       })
     }
    
  }

  // Used for all source sync apis (partial , full , multi)
  public async applyJsonData(context : RunContextServer ,  modelName : string , jsonRecords : Array<object> , redisRecords : Array<object> ) {

  }

  // 
  public destinationSync (rc : RunContextServer , sync : Array<syncInfo> ) {
      // Get destSynFields from Registry
  }


  // Update the mredis with required changes 
  private async applyData(rc : RunContextServer , results : object[] , masterCache : MasterCache  , todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string}}  ) {
    
    MaMgrLog('applyData results',results , 'mastercache keys:',lo.keysIn(masterCache) ,'TodoModels keys:' ,lo.keysIn(todoModelz) )
    
    for(const depMaster of lo.keysIn(masterCache)){
      if(masterCache[depMaster]) continue
      // Populate the dependent masters
      masterCache[depMaster] = await this.listActiveMasterData(rc , depMaster)
    }

    // verify all dependencies
    lo.forEach(todoModelz , (value : any , master : string) =>{
      MasterRegistryMgr.verifyAllDependency(rc , master , masterCache)
    })
    
    // verification done . Update the redis
    await this.updateMRedis(results , todoModelz)
    
    return results
  }

  private async updateMRedis(results : any[] , todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string}} ) {
    
    const multi : Multi = this.mredis.multi()
      
    for(const master  of lo.keysIn(todoModelz) ){
      
      const modData : {ssd : SourceSyncData , fDigest : string} = todoModelz[master] ,
            inserts : {[key : string] : any} = FuncUtil.toObject(modData.ssd.inserts) ,
            updates : {[key : string] : any} = FuncUtil.toObject(modData.ssd.updates) ,
            deletes : {[key : string] : any} = FuncUtil.toObject(modData.ssd.deletes) ,
            ts      : number = modData.ssd.modifyTs

      const modifications : StringValMap = FuncUtil.toStringifyMap(lo.assign({} , inserts , updates , deletes))  

      lo.forEach(modifications , (recStr : string , pk : string) => {
        
        //const recStr : string = JSON.stringify(value)
        multi.zadd([CONST.REDIS_NS + CONST.REDIS_TS_SET + master , 'CH', ts, pk ])
        multi.hset([CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master, pk, recStr])

      })
      multi.hset([CONST.REDIS_NS + CONST.REDIS_DIGEST_KEY , master, modData.fDigest])
      // result objects with info
      results.push({name : master , inserts : lo.size(inserts) , updates : lo.size(updates) , deletes : lo.size(deletes)})    
    }
    
    MaMgrLog('updating MRedis')
    await this.mredis.execMulti(multi)

    MaMgrLog('mredis publishing to channel' , CONST.REDIS_CHANNEL)
    await this.mredis.publish(CONST.REDIS_CHANNEL , JSON.stringify(lo.keysIn(todoModelz)) )
 
  }

  private async buildInMemoryCache() {
    //Todo :
    MaMgrLog('buildInMemoryCache')
  }

  // hash get functions 
  async hget (key : string , field : string) : Promise<string> {
    
    // Just for compilation
    const params = [key , field]
    const redis : RedisWrapper = this.mredis
    return await redis.redisCommand().hget(key , field)
  }
  
  async hmget(key : string , fields : string[]) : Promise<Array<object>> {
    
    const redis : RedisWrapper = this.mredis
    const res : any[] = await redis.redisCommand().hmget(key , ...fields)

    return res.map(item => {
        return JSON.parse(item)
      })
  }


  /*
  async hgetall(key : string) {
    
    const redis : RedisWrapper = this.mredis
    return await redis.redisCommand().hgetall(key)
  }
  */

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

  
  public async listAllMasterData(rc : RunContextServer , master : string) : Promise<GenValMap> {
    const masterKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master
    const map : StringValMap =  await this.mredis.redisCommand().hgetall(masterKey)
    
    // Parse the string value to object
    return FuncUtil.toParseObjectMap(map)
  }

  public async listActiveMasterData(rc : RunContextServer , master : string) : Promise<Map<string , any>> {
    const masterKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master
    let map : StringValMap =  await this.mredis.redisCommand().hgetall(masterKey)
    
    // Parse the string value to object
    let pMap : GenValMap = FuncUtil.toParseObjectMap(map)
    
    // remove deleted
    pMap = FuncUtil.reduce(pMap , (val : any , key : string) => {
      return !(val['deleted'] === true)
    })
    // convert to map and return 
    return FuncUtil.toMap(pMap)

  }

  private static async _getLatestRec(redis : RedisWrapper , master : string) : Promise<{key ?: string , ts ?: number}>  {
    const redisTskey : string = CONST.REDIS_NS + CONST.REDIS_TS_SET + master
    const res : string[] = redis.redisCommand().zrange(redisTskey , -1 , -1 , CONST.WITHSCORES)
    if(res.length) assert(res.length === 2 , '_getLatestRec invalid result ',res , master)
    else return {}

    assert(lo.isNumber(res[1]) , '_getLatestRec invalid result ', res , master)
    return {key : res[0] , ts: lo.toNumber(res[1])}
  }

}
