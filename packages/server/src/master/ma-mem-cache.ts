/*------------------------------------------------------------------------------
   About      : Master In Memory cache class required for destination sync
   
   Created on : Mon Jun 12 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as lo                from 'lodash'

import {MaMap, StringValMap , 
        GenValMap , 
       MasterCache }          from './ma-types'
import {MasterBase , 
        MasterBaseFields }    from './ma-base'
import {MasterRegistry}       from './ma-registry'             
import {MasterRegistryMgr}    from './ma-reg-manager'
import {masterDesc , assert , 
        concat , log ,
        MaType ,
        FuncUtil }            from './ma-util'
             

const LOG_ID : string = 'MasterInMemCache'
function MaInMemCacheLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}
function debug(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

export class DigestInfo {
  
  fileDigest      : string
  modTs           : number
  dataDigest      : string
  segDigestMap    : StringValMap  = {}

  public constructor(fDigest : string , ts : number , dDigest : string , segMap : StringValMap ) {
    this.fileDigest   = fDigest
    this.modTs        = ts 
    this.dataDigest   = dDigest
    this.segDigestMap = segMap
  }

  public static getDigest(val : any , masterKey : string) : DigestInfo {
    
    assert(lo.hasIn(val , 'fileDigest') && lo.hasIn(val , 'modTs') && lo.hasIn(val , 'dataDigest') && lo.hasIn(val , 'segDigestMap') , 'DigestInfo ',val , 'is corrept for master ',masterKey)
    assert( MaType.isString(val['fileDigest'])  && 
            MaType.isNumber(val['modTs']) &&
            MaType.isString(val['dataDigest']) , 'DigestInfo ', val , 'is corrept for master ',masterKey)

    return new DigestInfo(val['fileDigest'] , val['modTs'] , val['dataDigest'] , val['segDigestMap'])      
  }
}

export class MasterInMemCache {
  
  public cache               : boolean = false
  
  // records in sorted order
  public records             : object [] = []
  
  // hash key / record
  public hash                : GenValMap = {} 
  
  public modTSField          : string = MasterBaseFields.ModTs
  
  public cachedFields        : {fields :  string [] , cache : boolean} 
  public destSynFields       : {fields :  string [] , cache : boolean} 
  
  public digestInfo          : DigestInfo = new DigestInfo('',0 , '' , {})
  public lastUpdateTS        : number = lo.now()

  public getMaxTS() : number {
    return 0
  } 
  
  public getMinTS() : number {
    return 0
  }

  public constructor(public mastername : string , data : GenValMap , dInfo : DigestInfo) {
    
    MaInMemCacheLog('MasterInMemCache ',mastername)
    const registry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(mastername)

    this.cache          = registry.config.getCached()
    this.modTSField     = registry.config.getMasterTsField()
    this.cachedFields   = registry.config.getCachedFields()
    this.destSynFields  = registry.config.getDestSynFields()

    const size : number = lo.size(data)
    if(size) assert(dInfo!=null , 'Digest Info Missing for master with data',mastername, size)
    else assert(dInfo==null , 'Digest Info present for master without data', dInfo, mastername)

    if(!size) {
      MaInMemCacheLog('Nothing to populate in memory cache for master',mastername)
      return
    }

    // Populate cache
    this.digestInfo = dInfo

    // get cached fields.
    this.hash =  lo.mapValues(data , (val : any , key : string)=>{

      return this.cachedFields.cache ? lo.pick(val , this.cachedFields.fields) : lo.omit(val , this.cachedFields.fields)

    })
    
    // sort them by modTs field decending order
    this.records = lo.sortBy(lo.valuesIn(this.hash) , [this.modTSField]).reverse()

    MaInMemCacheLog('MasterInMemCache loading finished', this.records)
  }

}
