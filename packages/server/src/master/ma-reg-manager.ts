/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all masterbase models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'

import {RunContextServer}     from '../rc-server'
import {Master , MasterBase}  from './ma-base'
import {MasterRegistry , 
        MASTERBASE}           from './ma-registry'  
import {ModelConfig , 
  MasterValidationRule}       from './ma-model-config'  
import {SourceSyncData}       from './ma-manager'
import {masterDesc , assert , 
        concat , log}         from './ma-util'   

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


  public static validateBeforeSourceSync (rc : RunContextServer , mastername : string , source : Array<object> , redisData : Array<object> ) : SourceSyncData {
    
    this.verifySourceRecords(rc , this.getMasterRegistry(mastername) , source )

    return new Object() as SourceSyncData
  
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
  
  private static verifyModifications (source : Array<object> , target : Array<object> ) : (string | undefined) {
    return 
  }


}
