/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all masterbase models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import "reflect-metadata"
import {RunContextServer} from '../rc-server'
import {Master , MasterBase} from './ma-base'
import {SourceSyncData} from './ma-manager'
import {masterDesc , assert , log}                from './ma-util'   

const LOG_ID : string = 'MasterRegistryMgr'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

export type MasterFieldType = 'string' | 'object' | 'number' | 'boolean' | 'array'
//export type MasterFieldType = String | Number | Boolean | Object
function getType(t : any) : MasterFieldType {
  switch(t){
    
    case Number : return 'number'
    case String : return 'string'
    case Boolean : return 'boolean'
    case Object : return 'object'
    case Array  : return 'array'

    default :
      assert(false , 'unknown field type ',t)

  }
  // Never reachable
  return 'object'
}

export class FieldInfo {
  
  name    : string
  
  type    : MasterFieldType
  
  masType : Master.FieldType

  target  : object

  constructor(name : string , type : MasterFieldType , masType : Master.FieldType , target : object) {
    // Dont like using public specifier. For class members visibility
    this.name     = name
    this.type     = type
    this.masType  = masType
    this.target   = target
  }

}

export class MasterRegistry {
  
  constructor(master : string) {
    MaRegMgrLog('Creating Master ',master)
    this.mastername = master
  }

  mastername                : string
  
  construct                 : new (rc : any) => MasterBase
  
  masterInstance            : MasterBase
  
  pkFields                  : string[]
  
  fieldsMap                 : {[fieldName : string] : FieldInfo}
  
  config                    : Master.ModelConfig

  // Rules to verify Array
  rules             : ((obj : any) => void) []

  public verify(context : RunContextServer) {
    MaRegMgrLog('Verifying ',this.mastername)
    // Todo
    

    // In end create instance
    this.masterInstance = new this.construct(context)
  }

  public addField(fieldName : string , masType : Master.FieldType , target : object) {
    
    MaRegMgrLog('addField', this.mastername , fieldName , masType )
    
    assert(this.fieldsMap[fieldName] == null , masterDesc(this.mastername , fieldName , null) , 'added again')
    var t = Reflect.getMetadata("design:type", target, fieldName)
    assert(t && t.name , masterDesc(this.mastername , fieldName , null) , 'field information is missing')
    
    let type : MasterFieldType = getType(t)
    this.fieldsMap[fieldName] = new FieldInfo(fieldName , type , masType ,  target)

  }

}


/**
 * Class Maintaining the Registry of all masters & their field types
 * All Methods are static 
 */
export class MasterRegistryMgr {

  static regMap : {[mastername : string] : MasterRegistry}

  /*
  static pkField (target : any , propKey : string) : void {

  }*/
  
  static masterField (target : any , propKey : string , maType : Master.FieldType) : void {
    const master : string = target.constructor.name.toLowerCase() ,
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master)

    MaRegMgrLog('masterField ',master , propKey , maType)
    maReg.addField(propKey , maType ,target)

    if(maType === Master.FieldType.PRIMARY){
      assert(maReg.pkFields.indexOf(propKey) === -1 , 'pk added twice')
      maReg.pkFields.push(propKey)
    }
  }

  static addMaster (constructor : any , config : Master.ModelConfig) : void {
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
          maReg : MasterRegistry = MasterRegistryMgr.getMasterRegistry(master)

    MaRegMgrLog('fieldValidationRule ',master , propKey , rule)
    maReg.rules.push(rule)      
  }

  private static getMasterRegistry(master : string) : MasterRegistry {
    if(MasterRegistryMgr.regMap[master]) return MasterRegistryMgr.regMap[master]

    MasterRegistryMgr.regMap[master] = new MasterRegistry(master)
    return MasterRegistryMgr.regMap[master]
  }
  
  // Verify all the MasterRegistry for data sanity
  public init (context : RunContextServer ) : void {
    MaRegMgrLog('starting init')
    for(const master of Object.keys(MasterRegistryMgr.regMap) ){
      const maReg : MasterRegistry = MasterRegistryMgr.regMap[master]
      maReg.verify(context)
    }
  }


  public static validateBeforeSourceSync (mastername : string , source : Array<object> , redisData : Array<object> ) : SourceSyncData {
    
    return new Object() as SourceSyncData
  
  }

  public static verifyAllDependency (mastername : string , masterCache : {master : string , data : object[] }) {


  }
  
  // Private methods
  private static verifySourceRecords (source : Array<object>) : (string | undefined) {
    return 
  }
  
  private static verifyModifications (source : Array<object> , target : Array<object> ) : (string | undefined) {
    return 
  }


}
