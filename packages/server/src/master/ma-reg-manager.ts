/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all masterbase models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import "reflect-metadata"
import * as lo                from 'lodash'

import {RunContextServer}     from '../rc-server'
import {Master , MasterBase}  from './ma-base'
import {ModelConfig , 
  MasterValidationRule}       from './ma-model-config'  
import {SourceSyncData}       from './ma-manager'
import {masterDesc , assert , 
        concat , log}         from './ma-util'   

const LOG_ID : string = 'MasterRegistryMgr'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

export type MasterFieldType = 'string' | 'object' | 'number' | 'boolean' | 'array'
//export type MasterFieldType = String | Number | Boolean | Object
function getType(t : any) : MasterFieldType {
  switch(t){
    
    case Number     : return 'number'
    case String     : return 'string'
    case Boolean    : return 'boolean'
    case Object     : return 'object'
    case Array      : return 'array'

    default :
      assert(false , 'Unknown field type ',t)

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
  
  construct                 : new (rc : any , ...args : any[]) => MasterBase
  
  masterInstance            : MasterBase
  
  pkFields                  : string[]
  
  fieldsMap                 : {[fieldName : string] : FieldInfo}
  
  config                    : ModelConfig

  autoFields                : string []

  optionalFields            : string []
  
  // Rules to verify Array
  // Equivalent of MasterConfig rules verification
  rules             : ((obj : any) => void) []

  // Get id string from master rec
  public getIdStr(src : any) : string {
    if(this.pkFields.length === 1) return src[this.pkFields[0]]

    const id : any = {}
    this.pkFields.forEach(pk =>{
      id[pk] = src[pk]
    })

    return JSON.stringify(id)
  }
  
  public verify(context : RunContextServer) {
    
    MaRegMgrLog('Verifying ',this.mastername)
    
    // Todo
    /*
    1. verify that field name must not contain the . or should not be empty
    2. Must have set at least 1 PK
    3. PK Fields can not be object
    4. Populate autofields + other populations
    5. It must be an Instance of MasterBase

    */
    assert(this.pkFields.length > 0 , 'PK not set for master ', this.mastername)
    
    lo.forEach((finfo : FieldInfo , key : string)=>{
      // 1 check
      assert( key.length > 0 && key.indexOf('.') === -1 , 'Invalid key ',key , masterDesc(this.mastername , key , null))

      if(finfo.masType === Master.FieldType.PRIMARY && finfo.type === 'object'){
        throw (concat('PK ',key , 'can not be object ',this.mastername))
      }

    })

    this.autoFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.masType === Master.FieldType.AUTO
    }).map(info=>info.name)
                        
    const masterTsField : string = this.config.getMasterTsField()                    
    if(this.autoFields.indexOf(masterTsField)===-1){
      this.autoFields.push(masterTsField)
    } 


    // set optional fields
    this.optionalFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.masType === Master.FieldType.OPTIONAL
    }).map(info=>info.name)
    
    // In end create instance
    this.masterInstance = new this.construct(context , this.mastername)

    // check if this is an instance of master base
    assert(this.masterInstance instanceof MasterBase , this.mastername , 'is not an masterbase impl ')
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
  public init (context : RunContextServer ) : void {
    MaRegMgrLog('starting init')
    for(const master of Object.keys(MasterRegistryMgr.regMap) ){
      const maReg : MasterRegistry = MasterRegistryMgr.regMap[master]
      maReg.verify(context)
    }
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
