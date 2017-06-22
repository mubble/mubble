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
import {MasterBase , 
        MasterBaseFields}     from './ma-base'
import {RunContextServer}     from '../rc-server'
import {masterDesc , assert , 
        concat , log ,
        MaType ,
        FuncUtil }            from './ma-util'
        
import {ModelConfig}          from './ma-model-config'             
import {MasterRegistry}       from './ma-registry'             
import {MasterRegistryMgr}    from './ma-reg-manager'
import {MaMap, StringValMap , 
        GenValMap , 
       MasterCache }          from './ma-types'
import {MasterInMemCache , 
        DigestInfo , 
        SyncInfo}             from './ma-mem-cache'                     

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


export class SourceSyncData {
  
  mastername : string
  source     : GenValMap
  redisData  : GenValMap
  
  inserts    : GenValMap = {}
  updates    : GenValMap = {}
  deletes    : GenValMap = {}


  modifyTs   : number 

  public constructor(master : string , source : GenValMap , target : GenValMap , now : number ) {
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

  masterCache : MaMap<MasterInMemCache> = {}

  rc : RunContextServer

  dependencyMap : {[mastername : string] : string[]} = {}
  
  revDepMap : {[mastername : string] : string[]} = {}
  
  static created : boolean = false
  // Todo : make sure singleton instance
  public constructor() {
    if(MasterMgr.created){
      throw new Error('master manager can only be singleton')
    }
    MasterMgr.created = true
  }

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

  public async init(rc : RunContextServer , mredisUrl : string , sredisUrl : string ) : Promise<any> {
      
      if(this.rc || this.mredis || this.sredis){
        throw new Error('master mgr inited again')
      }

      this.rc = rc

      MasterRegistryMgr.init(rc)
      // Init the redis wrapper
      RedisWrapper.init(rc)
      
      this.mredis = await RedisWrapper.connect(rc , 'MasterRedis' , mredisUrl )
      this.sredis = await RedisWrapper.connect(rc , 'SlaveRedis' , sredisUrl )
      this.subRedis = await RedisWrapper.connect(rc , 'SubscriptionRedis' , sredisUrl )
      
      assert(this.mredis.isMaster() && this.sredis.isSlave() , 'mRedis & sRedis are not master slave' , mredisUrl , sredisUrl)
      
      this.buildDependencyMap()

      await this.checkSlaveMasterSync(false)

      await this.setSubscriptions()

      await this.buildInMemoryCache(rc)
  }

  private buildDependencyMap() : void {
    
    const dMap : {[master : string] : string[]} = this.dependencyMap
    const rdMap : {[master : string] : string[]} = this.revDepMap
    
    function getDepMasters(mas : string) : string[] {
      if(dMap[mas]) return dMap[mas]
      return MasterRegistryMgr.regMap[mas].config.getDependencyMasters()
    }

    MasterRegistryMgr.masterList().forEach(mas => {
      
      let dArr : string[] = getDepMasters(mas)
      let dlen = dArr.length ,
          mdlen = 0 
      
      // we need to get all dependencies of nth level 
      // (dependencies of dependencies of ...) recursively
      while(dlen !== mdlen){
        dlen = dArr.length
        lo.clone(dArr).forEach(dep=>{
          const depMas : string[] = getDepMasters(dep)
          //dArr = lo.uniq(dArr.concat(depMas))
          depMas.forEach(depM =>{
            if(dArr.indexOf(depM)===-1) dArr.push(depM)
          })
        })
        mdlen = dArr.length
      }
      
      dMap[mas] = dArr
      //MaRegMgrLog('buildDependencyMap 1',mas , dArr)
      //MaRegMgrLog('buildDependencyMap 2',dMap)
      
      // Reverse Mapping
      dArr.forEach(depMas=>{
        let rArr : string[] = rdMap[depMas]
        if(rArr==null){
          rArr = []
          rdMap[depMas] = rArr
        }
        rArr.push(mas)
      })

    })
    // Todo : remove empty array values masters / master with no dependency
    MaMgrLog('build Dependency Map finished\r\n',this.dependencyMap)
    MaMgrLog('build Reverse DependencyMap finished\r\n',this.revDepMap)
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
    
    const digestMap   : MaMap<DigestInfo> =  await this.getDigestMap()
    
    for(const mas of masters){
      await this.refreshAModel(mas , digestMap[mas] )
    }
  }

  async refreshAModel(mastername : string , dinfo : DigestInfo) {
    
    MaMgrLog('refreshing master', mastername)
    
    const redis : RedisWrapper = this.sredis ,
          memcache : MasterInMemCache = this.masterCache[mastername],
          redisTsKey : string  = CONST.REDIS_NS + CONST.REDIS_TS_SET + mastername ,
          redisDataKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + mastername ,
          lastTs   : number  = memcache.latestRecTs() , 
          resultWithTsScore : string [] = await redis.rwZrangebyscore(redisTsKey , '('+lastTs , CONST.PLUS_INFINITY, true) ,
          resultKeys :string [] = resultWithTsScore.filter((val : any , index : number)=>{ return index%2 ===0 }) ,
          resultScores : string [] =  resultWithTsScore.filter((val : any , index : number)=>{ return index%2 !==0 }) 

    if(!resultKeys.length){
      MaMgrLog('refreshAModel no records to update')
      return
    }
    const uniqueScores : string[] = lo.uniq(resultScores)
    assert(uniqueScores.length === 1 , 'model refresh inconsistency ' , mastername , uniqueScores , dinfo)
    assert(lo.toNumber(uniqueScores[0]) === dinfo.modTs , 'model refresh inconsistency ' , mastername , uniqueScores , dinfo )

    MaMgrLog('refreshAModel info', {mastername , lastTs } , resultKeys.length , resultKeys)

    const recs : string[] = await redis.redisCommand().hmget(redisDataKey , ...resultKeys)
    MaMgrLog('refreshAModel ',mastername , 'refreshed records:',recs.length /*, recs*/)

    assert(resultKeys.length === recs.length , 'invalid result from refresg redis' , resultKeys.length , recs.length)
    
    const newData : GenValMap = {}
    for(let i=0 ; i<resultKeys.length ; i++) {
      const pk : string = resultKeys[i] ,
            val : object = JSON.parse(recs[i])
      
      newData[pk] = val      
    }

    const res : any = memcache.update(newData , dinfo)
    MaMgrLog('refreshAModel result ',res)
 }
  
  public async applyFileData(rc : RunContextServer , arModels : {master : string , source: string} []) {
    
    const results : object [] = []
    
    const digestMap   : MaMap<DigestInfo> =  await this.getDigestMap() ,
          masterCache : MasterCache = {} ,
          todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string , modelDigest : string}} = {},
          // all masters update records will have same timestamp
          now         : number = lo.now()
    
    debug('digestMap:',digestMap , arModels.map((x)=> x.master) )     
    
    for(let i : number = 0 ; i <arModels.length ; i++ ){
      
      const oModel : {master : string , source: string} = arModels[i] 
      const registry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(oModel.master.toLowerCase())

      assert(registry!=null , 'Unknow master ',oModel.master.toLowerCase() , 'for file upload')
      registry.isAllowedFileUpload()
      
      const master  : string              = oModel.master.toLowerCase() ,
            mDigest : string              = digestMap[master] ? digestMap[master].fileDigest  : '' ,
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
     
     MaMgrLog('applyFileData' , master ,'inserts:' , lo.size(ssd.inserts) ,'updates:', lo.size(ssd.updates) , 'deletes:',lo.size(ssd.deletes) )
     this.setParentMapData(master , masterCache , ssd) 
     todoModelz[master] = {ssd : ssd , fDigest : fDigest , modelDigest : registry.getModelDigest()} 
     
    }

    if(lo.size(todoModelz)) await this.applyData(rc , results , masterCache , todoModelz)
    MaMgrLog('applyData' , 'results',results)
  }

  private setParentMapData(master : string , masterCache : MasterCache , ssd : SourceSyncData) : void {
     
     // master dependency data settings      
     if((lo.hasIn(masterCache , master) && masterCache[master] )){
        
        const depMap : GenValMap = masterCache[master]
        MaMgrLog(master , 'overriding source ',  lo.size(depMap) , lo.size(ssd.source)  )
        masterCache[master] = ssd.source
     }else{
       
       masterCache[master] = ssd.source
       MaMgrLog('setParentMapData' , master , 'source size' , lo.size(ssd.source) )
     }
     
     if(lo.hasIn(this.dependencyMap , master)){
       
       const depMasters : string [] = this.dependencyMap[master]
       depMasters.forEach((depMas : string)=>{
         if(!lo.hasIn(masterCache ,depMas)) masterCache[depMas] = null as any as GenValMap
       })
     }
    
  }

  // Used for all source sync apis (partial , full , multi)
  public async applyJsonData(context : RunContextServer ,  mastername : string , jsonRecords : any [] , redisRecords : GenValMap ) {

  }

  public async destinationSync (rc : RunContextServer , syncMap : MaMap<SyncInfo> ) {
    
    const response : {syncHash : GenValMap , syncData : GenValMap} = {syncHash : {} , syncData : {}}
    
    // check if there is any new data sync required
    const dataSyncRequired : string [] = [] ,
          purgeRequired    : string [] = []
    
    lo.forEach(syncMap , (synInfo : SyncInfo , mastername : string) =>{
      
      const memcache : MasterInMemCache = this.masterCache[mastername]

      assert(memcache!=null , 'Unknown master data sync request ',mastername)
      assert(synInfo.ts <= memcache.latestRecTs()  , 'syncInfo ts can not be greater than master max ts ',mastername , synInfo.ts , memcache.latestRecTs())
      
      if(memcache.cache && !memcache.hasRecords() ){
        // No Data in this master
        assert(synInfo.ts ===0 , 'No data in master ',mastername , 'last ts can not ', synInfo.ts)

      }else if( synInfo.modelDigest !== memcache.digestInfo.modelDigest ||
                synInfo.ts < memcache.getMinTS()) 
      {
        MaMgrLog('master digest change purging all',mastername , synInfo.modelDigest , memcache.digestInfo.modelDigest)
        synInfo.ts = 0
        dataSyncRequired.push(mastername)
        purgeRequired.push(mastername)

      }else if(synInfo.ts < memcache.latestRecTs()) {
        // sync required
        dataSyncRequired.push(mastername)
      
      }else {
        // Both are in sync
        assert(synInfo.ts === memcache.latestRecTs())
      }

    })

    if(!dataSyncRequired.length) return response

    for(const mastername of dataSyncRequired) {
      
      const memcache : MasterInMemCache = this.masterCache[mastername]
      if(memcache.cache){
        memcache.syncCachedData(rc , response.syncHash , response.syncData , syncMap[mastername] , purgeRequired.indexOf(mastername) !== -1 )
      }else{
        
        const masterData : GenValMap =  await this.listAllMasterData(rc , mastername)
        memcache.syncNonCachedData(rc , masterData , response.syncHash , response.syncData , syncMap[mastername] , purgeRequired.indexOf(mastername) !== -1 )
      }
    }
    
  }


  // Update the mredis with required changes 
  private async applyData(rc : RunContextServer , results : object[] , masterCache : MasterCache  , todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string , modelDigest : string}}  ) {
    
    MaMgrLog('applyData results',results , 'mastercache keys:',lo.keysIn(masterCache) ,'TodoModels keys:' ,lo.keysIn(todoModelz) )
    
    for(const depMaster of lo.keysIn(masterCache)){
      if(masterCache[depMaster]) continue
      // Populate the dependent masters
      masterCache[depMaster] = await this.listActiveMasterData(rc , depMaster)
      //debug('dependent master ',depMaster , 'size:', lo.size(masterCache[depMaster]) )
    }

    // verify all dependencies
    lo.forEach(todoModelz , (value : any , master : string) =>{
      MasterRegistryMgr.verifyAllDependency(rc , master , masterCache)
    })
    
    // verification done . Update the redis
    await this.updateMRedis(results , todoModelz)
    
    return results
  }

  private async updateMRedis(results : any[] , todoModelz  : {[master:string] : {ssd : SourceSyncData , fDigest : string , modelDigest: string}} ) {
    
    const multi : Multi = this.mredis.multi()
      
    for(const master  of lo.keysIn(todoModelz) ){
      
      const modData : {ssd : SourceSyncData , fDigest : string , modelDigest : string } = todoModelz[master] ,
            inserts : GenValMap = modData.ssd.inserts ,
            updates : GenValMap = modData.ssd.updates ,
            deletes : GenValMap = modData.ssd.deletes ,
            ts      : number = modData.ssd.modifyTs

      const modifications : StringValMap = FuncUtil.toStringifyMap(lo.assign({} , inserts , updates , deletes))  

      lo.forEach(modifications , (recStr : string , pk : string) => {
        
        //const recStr : string = JSON.stringify(value)
        multi.zadd([CONST.REDIS_NS + CONST.REDIS_TS_SET + master , 'CH', ts, pk ])
        multi.hset([CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master, pk, recStr])

      })
      // todo : Calculate Data Digest and other digest
      multi.hset([CONST.REDIS_NS + CONST.REDIS_DIGEST_KEY , master, JSON.stringify(new DigestInfo(modData.fDigest , modData.modelDigest , ts , '' , {} )) ])
      // result objects with info
      results.push({name : master , inserts : lo.size(inserts) , updates : lo.size(updates) , deletes : lo.size(deletes) , modTs : ts })    
    }
    
    MaMgrLog('updating MRedis')
    await this.mredis.execMulti(multi)

    MaMgrLog('mredis publishing to channel' , CONST.REDIS_CHANNEL)
    await this.mredis.publish(CONST.REDIS_CHANNEL , JSON.stringify(lo.keysIn(todoModelz)) )
 
  }

  private async buildInMemoryCache(rc : RunContextServer) {
    
    MaMgrLog('buildInMemoryCache started')
    const digestMap   : MaMap<DigestInfo> =  await this.getDigestMap() 
    
    for(const mastername of MasterRegistryMgr.masterList()) {
      
      MaMgrLog('Building InMemory Cache for ',mastername)
      assert(!lo.hasIn(this.masterCache , mastername) , 'mastercache already present for ',mastername)
      
      const masterData : GenValMap =  await this.listAllMasterData(rc , mastername)
      this.masterCache[mastername] = new MasterInMemCache(mastername , masterData , digestMap[mastername])
    }

    MaMgrLog('buildInMemoryCache finished')
  }

  private async getDigestMap() : Promise<MaMap<DigestInfo>> {
    
    const digestKey   : string = CONST.REDIS_NS + CONST.REDIS_DIGEST_KEY ,
          stringMap   : StringValMap =  await this.mredis.redisCommand().hgetall(digestKey),
          genMap      : GenValMap = FuncUtil.toParseObjectMap(stringMap)
    
    // Empty      
    if(!stringMap) return {}

    return lo.mapValues(genMap , (val : any , masterKey : string)=>{
        
        return DigestInfo.getDigest(val , masterKey)
    })
  }

  public async listAllMasterData(rc : RunContextServer , master : string) : Promise<GenValMap> {

    const masterKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master
    const map : StringValMap =  await this.mredis.redisCommand().hgetall(masterKey)
    
    // Parse the string value to object
    return FuncUtil.toParseObjectMap(map)
  }

  public async listActiveMasterData(rc : RunContextServer , master : string) : Promise<GenValMap> {

    const masterKey : string = CONST.REDIS_NS + CONST.REDIS_DATA_HASH + master
    let map : StringValMap =  await this.mredis.redisCommand().hgetall(masterKey)
    
    // Parse the string value to object
    let pMap : GenValMap = FuncUtil.toParseObjectMap(map)
    
    // remove deleted
    return lo.omitBy(pMap , (val : any , key : string) => {
      return (val[MasterBaseFields.Deleted] === true)
    }) as GenValMap

  }

  private static async _getLatestRec(redis : RedisWrapper , master : string , oldest : boolean = false) : Promise<{key ?: string , ts ?: number}>  {
    
    const redisTskey : string = CONST.REDIS_NS + CONST.REDIS_TS_SET + master
    const position : number = oldest ? 0 : -1
    const res : string[] = redis.redisCommand().zrange(redisTskey , position , position , CONST.WITHSCORES)
    if(res.length) assert(res.length === 2 , '_getLatestRec invalid result ',res , master)
    else return {}

    assert(lo.isNumber(res[1]) , '_getLatestRec invalid result ', res , master)
    return {key : res[0] , ts: lo.toNumber(res[1])}
  }

}
