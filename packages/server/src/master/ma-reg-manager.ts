/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all masterbase models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'

import {RunContextServer}     from '../rc-server'
import {Master , MasterBase,
        MasterBaseFields }    from './ma-base'
import {MasterRegistry , 
        MASTERBASE , 
        FieldInfo }           from './ma-registry'  
import {ModelConfig , 
  MasterValidationRule}       from './ma-model-config'  
import {SourceSyncData}       from './ma-manager'
import {masterDesc , assert , 
        concat , log ,
        maArrayMap}                from './ma-util'   

const LOG_ID : string = 'MasterRegistryMgr'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

/**
 * Class Maintaining the Registry of all masters & their field types
 * All Methods are static 
 */
export class MasterRegistryMgr {

  static regMap : {[mastername : string] : MasterRegistry} = {}

  /*
  static pkField (target : any , propKey : string) : void {

  }*/
  
  static masterField (target : any , propKey : string , maType : Master.FieldType) : void {
    const master : string = target.constructor.name.toLowerCase() ,
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master , true)

    MaRegMgrLog('masterField ',master , propKey , maType)
    maReg.addField(propKey , maType ,target)

    if(maType === Master.FieldType.PRIMARY){
      assert(maReg.pkFields.indexOf(propKey) === -1 , 'pk added twice')
      maReg.pkFields.push(propKey)
    }
  }

  static addMaster (constructor : any , config : ModelConfig) : void {
    const master : string = constructor.name.toLowerCase() ,
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master)

    MaRegMgrLog('addMaster ',master , constructor)
    MaRegMgrLog('addMaster config ',master , config)

    assert(maReg.construct == null && maReg.config == null && maReg.masterInstance == null  , 'master ',master , 'registered twice')
    
    maReg.construct = constructor
    maReg.config    = config
  }

  static fieldValidationRule (target : any , propKey : string , rule : (obj : any) => void ) : void {
    const master : string = target.constructor.name.toLowerCase() ,
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master , true)

    MaRegMgrLog('fieldValidationRule ',master , propKey , rule)
    maReg.rules.push(rule)      
  }

  private static getMasterRegistry(master : string , create : boolean = false) : MasterRegistry {
    if(MasterRegistryMgr.regMap[master]) return MasterRegistryMgr.regMap[master]
    
    if(create){
      MasterRegistryMgr.regMap[master] = new MasterRegistry(master)
    }

    return MasterRegistryMgr.regMap[master]
  }
  
  // Verify all the MasterRegistry for data sanity
  public static init (context : RunContextServer ) : void {
    MaRegMgrLog('starting init')
    
    // check masterbase registry exists
    const masterbaseReg : MasterRegistry =  MasterRegistryMgr.regMap[MASTERBASE]
    assert(masterbaseReg!=null , MASTERBASE , 'Registry missing')
    const masterbaseFields : string [] =  lo.keysIn(masterbaseReg.fieldsMap)
    
    const customMasters : MasterRegistry[] = lo.filter(MasterRegistryMgr.regMap , (maReg : MasterRegistry , master : string)=>{
      return master !== MASTERBASE
    })

    customMasters.forEach((maReg : MasterRegistry)=>{
      
      const maFields : string[] = lo.keysIn(maReg.fieldsMap)
      assert( lo.isEmpty (lo.intersection(masterbaseFields , maFields)) , maReg.mastername , 'has masterbase fields ',maFields , masterbaseFields)
      maReg.fieldsMap = lo.assignIn(maReg.fieldsMap , masterbaseReg.fieldsMap)
    })
    
    // verify all custom masters
    customMasters.forEach((maReg : MasterRegistry)=>{
      maReg.verify(context)
    })

  }


  public static validateBeforeSourceSync (rc : RunContextServer , mastername : string , source : Array<object> , redisData : Map<string , any> ) : SourceSyncData {
    
    this.verifySourceRecords(rc , this.getMasterRegistry(mastername) , source )

    //todo : accompny master check

    return this.verifyModifications(rc , this.getMasterRegistry(mastername) , source , redisData)
  }

  public static verifyAllDependency (rc : RunContextServer , mastername : string , masterCache : {master : string , data : object[] }) {


  }
  
  // Private methods
  private static verifySourceRecords (rc : RunContextServer , maReg : MasterRegistry ,  source : Array<any>) {
    const mastername : string = maReg.mastername 

    // remove deleted recoreds
    source  = source.filter((src)=>{
      // todo get id
      if(src.deleted) MaRegMgrLog('master',mastername , 'verifySourceRecords', 'removed from src',maReg.getIdStr(src))
      return !(src.deleted === true)
    })

    // Field Type sanity validation rules
    maReg.config.getSrcValidationrules().forEach( (srcValidationRule : MasterValidationRule)=>{
      MaRegMgrLog('applying SrcValidation Rule rule ', srcValidationRule.constructor.name , 'on master', maReg.mastername)
      srcValidationRule(rc , maReg , source)
    })

    // Config Rules Check
    maReg.rules.forEach(  (configRule : (obj : any) => void ) => {
      MaRegMgrLog('applying Config rule ', configRule.constructor.name , 'on master', maReg.mastername)
      source.forEach((rec:any)=>{
        configRule(rec)
      })
    } )

  }
  
  private static verifyModifications (rc : RunContextServer , registry : MasterRegistry , sourceRecs : Array<any> , targetMap : Map<string , any> ) : SourceSyncData {
    
    MaRegMgrLog('verifyModifications' , registry.mastername ,'source:' , sourceRecs.length , 'target:', targetMap.size )

    const config : ModelConfig = registry.config , 
          masTsField : string  = config.getMasterTsField() ,
          now : number         = lo.now() ,
          fldMap : {[field : string] : FieldInfo}    = registry.fieldsMap ,
          ssd : SourceSyncData = new SourceSyncData(registry.mastername , sourceRecs , targetMap) ,
          instanceObj : MasterBase = registry.masterInstance , 
          allFields : string [] = registry.allFields ,
          ownFields : string [] = registry.ownFields ,
          target : Array<any> = lo.valuesIn(targetMap)


    const sourceIdsMap : {[key : string] : any} = maArrayMap<any>(sourceRecs , (rec : any)=>{
      return {key : registry.getIdStr(rec) , value : rec}
    })
    
    sourceRecs.forEach((srcRec : any) => {
      const pk : string = registry.getIdStr(srcRec) , 
            ref : any   = targetMap.get(pk)


      if(!ref) {
        // this is an new record
        // check allow insert . allow all
        
        instanceObj.verifyRecord(rc , srcRec )
        
        if(lo.hasIn(fldMap , MasterBaseFields.Deleted )) srcRec[MasterBaseFields.Deleted] = false
        srcRec[masTsField] = now
        ssd.inserts.push(srcRec)

      }else if (ref[MasterBaseFields.Deleted] || this.isModified(rc , allFields , ownFields , masTsField , ref , srcRec ) ){
        
        instanceObj.verifyRecord(rc , srcRec , ref)

        if(lo.hasIn(fldMap , MasterBaseFields.Deleted)) srcRec[MasterBaseFields.Deleted] = false
        srcRec[masTsField] = now
        srcRec[MasterBaseFields.CreateTs] = ref[MasterBaseFields.CreateTs]

        ssd.updates.push(srcRec)
      }

    })

    // Check if there are any records deleted
    target.forEach((ref : any)=>{
      // Ignore already deleted
      if(ref[MasterBaseFields.Deleted]) return

      const src : any = sourceIdsMap[registry.getIdStr(ref)]
      if(!src) {
        // This record is deleted
        const delRec : any = lo.cloneDeep(ref)
        
        delRec[MasterBaseFields.Deleted] = true
        delRec[masTsField] = now
        ssd.updates.push(delRec)
      }
    })
    
    return ssd
  }

  private static isModified(rc : RunContextServer , allFields : string[] , ownFields : string[] , masterTs : string , ref : any , src : any ) : boolean {

    let res : boolean = ownFields.some((key : string) : boolean => {
      if(key === masterTs) false 
      const val = src[key] , refVal = ref[key] 
      if(lo.isUndefined(val)) return true

      return !lo.isEqual(val , refVal)

    } )
    if(res) return true

    return lo.some(ref , (refval : any , refKey : string)=>{
      return allFields.indexOf(refKey) === -1
    })
  }

}
