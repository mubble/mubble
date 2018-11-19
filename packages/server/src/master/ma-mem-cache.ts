/*------------------------------------------------------------------------------
   About      : Master In Memory cache class required for destination sync
   
   Created on : Mon Jun 12 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import * as crypto            from 'crypto'

import {
        MasterCache 
       }                      from './ma-types'
import {
        MasterBase, 
        MasterBaseFields
       }                      from './ma-base'
import {
        masterDesc,
        assert, 
        concat,
        log,
        MaType,
        FuncUtil
       }                      from './ma-util'
import {RunContextServer}     from '../rc-server'
import {MasterRegistry}       from './ma-registry'             
import {MasterRegistryMgr}    from './ma-reg-manager'
import {ModelConfig}          from './ma-model-config'  

import {SyncHashModel , 
        SyncHashModels ,
        SyncRequest ,
        SyncResponse ,
        Segments , 
        SegmentType ,
        SyncModelResponse,
        Mubble}               from '@mubble/core'                             

             

const LOG_ID : string = 'MasterInMemCache'

function MaInMemCacheLog(rc : RunContextServer | null , ...args : any[] ) : void {
  if(rc){
    rc.isStatus() && rc.status(LOG_ID , ...args )
  }else{
    log(LOG_ID , ...args)
  }
}

function debug(rc : RunContextServer | null , ...args : any[] ) : void {
  if(rc){
    rc.isDebug && rc.debug(LOG_ID , ...args )
  }else{
    log(LOG_ID , ...args)
  }
}


export class SyncInfo {
  ts          : number 
  seg         : object 
  dataDigest  : string
  modelDigest : string
}


export class DigestInfo {
  
  fileDigest   : string
  modelDigest  : string 
  modTs        : number
  dataDigest   : string
  segDigestMap : Mubble.uObject<string>  = {}

  public constructor(fDigest : string, modelDigest : string, ts : number, dDigest : string, segMap : Mubble.uObject<string>) {
    this.fileDigest   = fDigest
    this.modelDigest  = modelDigest
    this.modTs        = ts 
    this.dataDigest   = dDigest
    this.segDigestMap = segMap
  }

  public static getDigest(val : any , masterKey : string) : DigestInfo {
    
    assert(lo.hasIn(val , 'fileDigest') && lo.hasIn(val , 'modelDigest') && lo.hasIn(val , 'modTs') && lo.hasIn(val , 'dataDigest') && lo.hasIn(val , 'segDigestMap') , 'DigestInfo ',val , 'is corrupt for master ',masterKey)
    assert( MaType.isString(val['fileDigest'])  && 
            MaType.isString(val['modelDigest'])  && 
            MaType.isNumber(val['modTs']) &&
            MaType.isString(val['dataDigest']) , 'DigestInfo ', val , 'is corrupt for master ',masterKey)

    return new DigestInfo(val['fileDigest'] , val['modelDigest'] , val['modTs'] , val['dataDigest'] , val['segDigestMap'])      
  }
}

export class MasterInMemCache {
  
  public cache               : boolean = false
  
  // records in sorted order
  public records             : any [] = []
  
  // hash key / record
  public hash                : Mubble.uObject<object> = {} 
  
  public modTSField          : string = MasterBaseFields.ModTs
  
  public digestInfo          : DigestInfo = new DigestInfo('','', 0 , '' , {})
  //public lastUpdateTS        : number = lo.now()

  public getMaxTS() : number {
    return this.records.length ?  lo.nth(this.records , 0)[this.modTSField] : 0
  } 
  
  // This has to be saved for non -cache data
  public getMinTS() : number {
    return this.records.length ?  lo.nth(this.records , -1)[this.modTSField] : 0
  }

  public hasRecords() : boolean {
    return (this.records.length > 0)
  }

  public latestRecTs() : number {
    return this.digestInfo.modTs
  }

  public constructor(rc : RunContextServer , public mastername : string , data : Mubble.uObject<object> , dInfo : DigestInfo) {
    const registry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(mastername)

    this.cache          = registry.config.getCached()
    this.modTSField     = registry.config.getMasterTsField()
    
    if(this.cache){
      const size : number = lo.size(data)
      if(size) assert(dInfo!=null , 'Digest Info Missing for master with data',mastername, size)
      else assert( (dInfo==null) || dInfo.fileDigest === (crypto.createHash('md5').update(JSON.stringify([])).digest('hex'))  , 'Digest Info present for master without data', dInfo, mastername)

      if(!size) {
        if(dInfo!=null) this.digestInfo = dInfo
        debug(rc , 'Nothing to populate in memory cache for master',mastername)
        return
      }
      this.digestInfo = dInfo
    }else{
      debug(rc , 'caching is disabled for master ',mastername)
      if(dInfo!=null) this.digestInfo = dInfo
      return
    }

    // Populate cache
    // Fields which needs to be cached
    const allCachedFields : string[] = lo.uniq(registry.cachedFields.concat(registry.autoFields)) 
    // MaInMemCacheLog(rc , 'allCachedFields ', allCachedFields , 'destSyncFields', registry.destSyncFields )
    
    this.hash =  lo.mapValues(data , (val : any , key : string)=>{
      return lo.pick(val , allCachedFields)
    }) as any
    
    // sort them by modTs field descending order
    this.records = lo.sortBy(lo.valuesIn(this.hash) , [this.modTSField]).reverse()
    assert(this.getMaxTS() === this.digestInfo.modTs , mastername, 'Digest Info data inconsistency ',this.getMaxTS() , this.digestInfo)

    // Freeze the records
    this.records.forEach((rec : any)=>{ Object.freeze(rec)})
    
    debug(rc , `MasterInMemCache loading finished for ${mastername}, Count: ${this.records.length}`)
  }

  public update(rc : RunContextServer , newData : Mubble.uObject<object> , dInfo : DigestInfo) : {inserts : number , updates : number} {
    
    debug(rc , 'update ',this.mastername , lo.size(newData) , dInfo , lo.size(this.hash))
    const registry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(this.mastername)

    this.digestInfo = dInfo
    
    const result = {inserts : 0 , updates : 0 , cache : this.cache}
    if(!this.cache) return result
    
    // Fields which needs to be cached
    const allCachedFields : string[] = lo.uniq(registry.cachedFields.concat(registry.autoFields)) 
    
    const cacheNewData : Mubble.uObject<object> = lo.mapValues(newData , (val : any , key : string)=>{

      return lo.pick(val , allCachedFields)
    }) as any
    
    // Ensure that all the data available is modified
    lo.forEach(cacheNewData , (newData : any , newPk : string) => {
      
      if(!lo.hasIn(this.hash , newPk)) {
        // new data
        result.inserts++
        return 
      } 
      assert(!lo.isEqual(cacheNewData , this.hash[newPk]) , 'same data given for memory cache update ',newPk , newData)
      result.updates++
    })

    this.hash = lo.assign({} , this.hash , cacheNewData)
    
    // sort them by modTs field descending order
    this.records = lo.sortBy(lo.valuesIn(this.hash) , [this.modTSField]).reverse()
    assert(this.getMaxTS() === this.digestInfo.modTs , this.mastername, 'Digest Info data inconsistency ',this.getMaxTS() , this.digestInfo)

    this.records.forEach((rec : any)=>{ Object.freeze(rec)})

    debug(rc , 'MasterInMemCache update finished', this.mastername , this.records)
    return result
  }

  public syncCachedData(rc : RunContextServer , segments : Segments , syncInfo : SyncHashModel , purge : boolean ) : SyncModelResponse {
    
    const registry      : MasterRegistry = MasterRegistryMgr.getMasterRegistry(this.mastername),
          config        : ModelConfig = registry.config ,
          configSegment  : {key : string , cols : string[]} | undefined = config.getSegment() 
    
    debug(rc , 'syncCachedData request', registry.mastername, syncInfo , purge)
          
    let segRef        : SegmentType = configSegment ? (segments || {})[configSegment.key] : []
    segRef = segRef || []
    let modelSeg     : SegmentType = syncInfo.ts ? (syncInfo.seg || []) : []
    
    let arrSame      : SegmentType = [] ,
        arrPlus      : SegmentType = [] ,
        arrMinus     : SegmentType = []
    
    if(configSegment) this.arrayDiff(segRef , modelSeg , arrPlus , arrMinus , arrSame)
    
    const updates : any [] = [] ,
          deletes : any [] = [] ,
          segEqual : boolean =  (arrPlus.length > 0) || (arrMinus.length > 0)
    
    let   data    : {mod : any [] , del : any []}    = {mod : updates , del : deletes}
    
    if(arrMinus.length && syncInfo.ts){ // some segments have been removed
      syncInfo.ts = 0
      purge = true
      rc.isWarn() && rc.warn(rc.getName(this), 'destination sync remove old data', segRef , {model : registry.mastername , minus : arrMinus })
    }else if(syncInfo.ts && arrPlus.length){
      rc.isWarn() && rc.warn(rc.getName(this), 'destinationSync: add new data. Removing Old',segRef , {modelName: registry.mastername, plus: arrPlus })
      // Not doing match segment for arrsame for ts > syncInfo.ts & arrPlus for ts > 0
      // App is data heavy . why be so frugal with data
      syncInfo.ts = 0
      purge = true
    }
    

    for(const rec of this.records) {
      // should this be just < . let = comparison be there to be on safe side
      if(segEqual && syncInfo.ts && rec[this.modTSField] <= syncInfo.ts) break
      
      if(configSegment){
        if(!registry.masterInstance.matchSegment(rc , segRef , configSegment.cols , rec)) continue // segment does not match
      }

      if(rec[MasterBaseFields.Deleted] === true){
        // All the Pk's field might not be understood by client.
        // send him only the pk fields , which he understands (dest sync)
        deletes.push(lo.pick(rec , lo.intersection(registry.pkFields , registry.destSyncFields) ))
      }else{
        const destRec : any = lo.pick(rec , registry.destSyncFields )
        updates.push(destRec)
      }
    }
    
    assert(configSegment!=null ||  (deletes.length!==0  || updates.length!==0) , 'syncData Invalid results', this.mastername , syncInfo , this.digestInfo )

    const synHash : SyncHashModel = {
      ts            : this.digestInfo.modTs 
      /*modelDigest   : this.digestInfo.modelDigest ,
      dataDigest    : this.digestInfo.dataDigest,*/
    }
    if(configSegment) synHash.seg = segRef
    
    data = registry.masterInstance.syncGetModifications( rc , data )
    
    const syncResp : SyncModelResponse = {
      mod          : data.mod ,
      del          : data.del ,
      purge        : purge ,
      hash         : synHash
    }
    
    debug(rc , 'syncCachedData response', registry.mastername , synHash , updates.length , deletes.length )
    debug(rc , 'syncCachedData updates response', registry.mastername , updates.length ,  updates )
    debug(rc , 'syncCachedData deletes response', registry.mastername , deletes.length  , deletes  )

    return syncResp
  }

  /*
  private addModDelRecs(rc : RunContextServer , modelObj : MasterBase, refTS : number , arSeg : SegmentType , colSeg : any[] , oRet : {mod : any [] , del : any []} , checkDuplicate : boolean ) {


  }*/

  private arrayDiff(arMain : SegmentType , arModel : SegmentType , arPlus : SegmentType , arMinus : SegmentType , arSame : SegmentType) {
    
    arMain.forEach(function(item : any[]) {
      if (arModel.find((seg: any[])=>{ return lo.isEqual(seg , item)})) {
        arSame.push(item)
      } else {
        arPlus.push(item)
      }
    })

    arModel.forEach(function(item : any[]) {
      if (arMain.find((seg: any[])=>{ return lo.isEqual(seg , item)})) {
        arMinus.push(item)
      }
    })
  }
  
  public syncNonCachedData(rc : RunContextServer ,  segments : Segments  , masterData : Mubble.uObject<object> , syncInfo : SyncHashModel , purge : boolean  ) : SyncModelResponse {
    
    debug(rc , 'syncNonCachedData', syncInfo , purge)
    
    const registry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(this.mastername)
    
    // Get all the items >= syncInfo.ts
    const updates : any [] = [] ,
          deletes : any [] = [] 
    
    let data    : {mod : any [] , del : any []}    = {mod : updates , del : deletes}
    
    lo.forEach(masterData , (rec : any , pk : string) => {
      
      // should this be just < . let = comparison be there to be on safe side
      if(rec[this.modTSField] <= syncInfo.ts) return

      if(rec[MasterBaseFields.Deleted] === true){
        deletes.push(lo.pick(rec , registry.pkFields ))
      }else{
        const destRec  : any = lo.pick(rec , registry.destSyncFields )
        updates.push(destRec)
      }

    })

    assert( deletes.length!==0  || updates.length!==0 , 'syncData Invalid results', this.mastername , syncInfo , this.digestInfo )

    const synHash : SyncHashModel = {
      ts            : this.digestInfo.modTs ,
      seg           : syncInfo.seg
      /*modelDigest   : this.digestInfo.modelDigest ,
      dataDigest    : this.digestInfo.dataDigest,*/
      
    }
    
    data = registry.masterInstance.syncGetModifications( rc , data )
    
    const syncResp : SyncModelResponse = {
      mod          : data.mod ,
      del          : data.del ,
      purge        : purge ,
      hash         : synHash
    }
    
    debug(rc , 'syncNonCachedData' , synHash , updates.length , deletes.length , updates , deletes  )

    return syncResp
  }

}
