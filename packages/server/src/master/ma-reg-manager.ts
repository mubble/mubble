/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all masterbase models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../rc-server'
import {Master , MasterBase} from './ma-base'
import {SourceSyncData} from './ma-manager'


export type MasterFieldType = 'string' | 'object' | 'number' | 'boolean'

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
  
  protected constructor(master : string) {
    this.mastername = master
  }

  mastername                : string
  
  prototype                 : object 
  
  masterInstance            : MasterBase
  
  pkFields                  : string[]
  
  fieldsMap                 : {[fieldName : string] : FieldInfo}
  
  config                    : Master.ModelConfig

  // Rules to verify Array
  rules             : ((obj : object) => string) []

  private _rc       : RunContextServer

  public verify() {

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

  }

  static addMaster (target : any , config : Master.ModelConfig) : void {

  }

  static fieldValidationRule (target : any , propKey : string , rule : (obj : any) => void ) : void {

  }
  
  // Verify all the MasterRegistry for data sanity
  public init (context : RunContextServer ) : void {

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
