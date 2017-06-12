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
        FuncUtil}             from './ma-util' 
import {StringValMap , 
        GenValMap , 
        MasterCache}          from './ma-types'              
          

const LOG_ID : string = 'MasterRegistryMgr'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}
function debug(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

/**
 * Class Maintaining the Registry of all masters & their field types
 * All Methods are static 
 */
export class MasterRegistryMgr {

  static regMap : {[mastername : string] : MasterRegistry} = {}
  static dependencyMap : {[mastername : string] : string[]} = {}
  static revDepMap : {[mastername : string] : string[]} = {}
  
  public static masterList() : string[] {
    return lo.keysIn(this.regMap).filter((mas : string)=> {
      return mas !== MASTERBASE
    })
  }

  private static buildDependencyMap() : void {
    const dMap : {[master : string] : string[]} = this.dependencyMap
    const rdMap : {[master : string] : string[]} = this.revDepMap
    
    function getDepMasters(mas : string) : string[] {
      if(dMap[mas]) return dMap[mas]
      return MasterRegistryMgr.regMap[mas].config.getDependencyMasters()
    }

    lo.keysIn(this.regMap).filter(ma=> ma!== MASTERBASE).forEach(mas => {
      
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
    //MaRegMgrLog('build Dependency Map finished\r\n',this.dependencyMap)
    //MaRegMgrLog('build Reverse DependencyMap finished\r\n',this.revDepMap)
  }
  
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

    //MaRegMgrLog('addMaster ',master , constructor)
    MaRegMgrLog('addMaster config ',master , config)

    assert(maReg.construct == null && maReg.config == null && maReg.masterInstance == null  , 'master ',master , 'registered twice')
    
    maReg.construct = constructor
    maReg.config    = config
  }

  static fieldValidationRule (target : any , propKey : string , rule : (obj : any) => void ) : void {
    const master : string = target.constructor.name.toLowerCase() ,
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master , true)

    //MaRegMgrLog('fieldValidationRule ',master , propKey , rule)
    maReg.rules.push(rule)      
  }

  private static getMasterRegistry(master : string , create : boolean = false) : MasterRegistry {
    if(MasterRegistryMgr.regMap[master]) return MasterRegistryMgr.regMap[master]
    
    if(create){
      MasterRegistryMgr.regMap[master] = new MasterRegistry(master)
    }

    return MasterRegistryMgr.regMap[master]
  }
  
  public static isAllowedFileUpload(master : string) {
    
    const registry : MasterRegistry = this.getMasterRegistry(master)
    assert(registry!=null , 'Unknow master ',master , 'for file upload')
    assert(registry.config.getHasFileSource() , 'master',master , 'is not file sourced')

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

    this.buildDependencyMap()
  }


  public static validateBeforeSourceSync (rc : RunContextServer , mastername : string , source : Array<object> , redisData : GenValMap , now : number ) : SourceSyncData {
    const registry : MasterRegistry = this.getMasterRegistry(mastername)
    this.verifySourceRecords(rc , registry , source )

    //todo : accompny master check
    const sourceIdsMap : GenValMap = FuncUtil.maArrayMap<any>(source , (rec : any)=>{
      return {key : registry.getIdStr(rec) , value : rec}
    })
    

    return this.verifyModifications(rc , this.getMasterRegistry(mastername) , sourceIdsMap  , redisData , now)
  }

  public static verifyAllDependency (rc : RunContextServer , mastername : string , masterCache : MasterCache ) {
    MaRegMgrLog('verifyAllDependency for master' , mastername )
    //if(lo.stubTrue()) return
    const registry : MasterRegistry = this.getMasterRegistry(mastername) ,
          fkConst  : Master.ForeignKeys = registry.config.getForeignKeys() ,
          selfData : GenValMap = masterCache[mastername] 
    //debug('fk for master',mastername , fkConst)

    lo.forEach(fkConst , (props : GenValMap , parent : string)=> {

      assert(lo.hasIn(masterCache , parent) , 'parent mastercache', parent , 'is missing for master',mastername)
      const parentData : GenValMap = masterCache[parent] 
      
      //debug('parent size ',lo.size(parentData))
      lo.forEach(props , (selfField : string , parentField : string)=>{
        //debug('selfField',selfField , 'parent', parentField , selfData)
      
        // verify self data field with parent data
        lo.forEach(selfData , (selfRec : any , pk : string)=>{
          //debug('selfRec',selfRec , 'pk',pk)
          const selfVal : any =  selfRec[selfField]
          assert(selfVal!=null , 'dependency field data null', selfRec , pk , selfField)

          const found : boolean = lo.some(parentData, (parentRec : any , parentPk : string)=>{
            return lo.isEqual(selfVal , parentRec[parentField])
          })
          assert(found , 'dependency field ',selfField ,'value:',selfVal, 'for master:',mastername, 'pk:',pk , 'not found in parent master:',parent , 'field:',parentField)
        })

      })

    }) 
  }
  
  // Private methods
  private static verifySourceRecords (rc : RunContextServer , maReg : MasterRegistry ,  source : Array<any>) {
    const mastername : string = maReg.mastername 

    // remove deleted recoreds
    source  = source.filter((src)=>{
      
      if(src[MasterBaseFields.Deleted]) MaRegMgrLog('master',mastername , 'verifySourceRecords', 'removed from src',maReg.getIdStr(src))
      return !(src[MasterBaseFields.Deleted] === true)
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
  
  private static verifyModifications (rc : RunContextServer , registry : MasterRegistry , sourceIds : GenValMap , targetMap : GenValMap , now : number ) : SourceSyncData {
    
    MaRegMgrLog('verifyModifications' , registry.mastername ,'source size:' , lo.size(sourceIds) , 'target size:', lo.size(targetMap) )

    const config : ModelConfig = registry.config , 
          masTsField : string  = config.getMasterTsField() ,
          fldMap : {[field : string] : FieldInfo}    = registry.fieldsMap ,
          ssd : SourceSyncData = new SourceSyncData(registry.mastername , sourceIds , targetMap , now) ,
          instanceObj : MasterBase = registry.masterInstance , 
          allFields : string [] = registry.allFields ,
          ownFields : string [] = registry.ownFields 


    lo.forEach(sourceIds , (srcRec : any , pk: string) => {
      
      const ref : any   = targetMap[pk]
      
      if(!ref) {
        // this is an new record
        // check allow insert . allow all
        
        instanceObj.verifyRecord(rc , srcRec )
        
        //if(lo.hasIn(fldMap , MasterBaseFields.Deleted )) srcRec[MasterBaseFields.Deleted] = false
        srcRec[MasterBaseFields.Deleted] = false
        srcRec[MasterBaseFields.CreateTs] = srcRec[masTsField] = now
        ssd.inserts[pk] = srcRec

      }else if (ref[MasterBaseFields.Deleted] || this.isModified(rc , allFields , ownFields , masTsField , ref , srcRec ) ){
        
        instanceObj.verifyRecord(rc , srcRec , ref)

        //if(lo.hasIn(fldMap , MasterBaseFields.Deleted)) srcRec[MasterBaseFields.Deleted] = false
        srcRec[MasterBaseFields.Deleted] = false
        srcRec[masTsField] = now
        srcRec[MasterBaseFields.CreateTs] = ref[MasterBaseFields.CreateTs]

        ssd.updates[pk] = srcRec
      }

    })

    // Check if there are any records deleted
    lo.forEach(targetMap , (ref : any , id : string)=>{
      // Ignore already deleted
      if(ref[MasterBaseFields.Deleted]) return
      
      const src : any = sourceIds[id]
      if(!src) {
        // This record is deleted
        const delRec : any = lo.cloneDeep(ref)
        
        delRec[MasterBaseFields.Deleted] = true
        delRec[masTsField] = now
        ssd.deletes[id] = delRec
      }
    } )
    
    return ssd
  }

  private static isModified(rc : RunContextServer , allFields : string[] , ownFields : string[] , masterTs : string , ref : any , src : any ) : boolean {
    //debug('isModified', 'all:',allFields , 'own:',ownFields , 'masterTs:',masterTs)
    let res : boolean = ownFields.some((key : string) : boolean => {
      if(key === masterTs) return false 
      const val = src[key] , refVal = ref[key] 
      if(lo.isUndefined(val)) return true

      return !lo.isEqual(val , refVal)

    } )
    //if(res) debug('isModified results 1',src , ref)
    if(res) return true

    res = lo.some(ref , (refval : any , refKey : string)=>{
      return allFields.indexOf(refKey) === -1
    })
    //if(res) debug('isModified results 2',src , ref)
    
    return res
  }

}
