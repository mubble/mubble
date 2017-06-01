/*------------------------------------------------------------------------------
   About      : Class maintaing all the registry information (through decorators) of all master base models
   
   Created on : Wed May 31 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../rc-server'
import {ModelConfig , MasterBase} from './ma-base'
import {SourceSyncData} from './ma-manager'


export class MasterRegistry {
  
  protected constructor(master : string) {
    this.mastername = master
  }

  mastername                : string
  
  prototype                 : object 
  
  masterInstance            : MasterBase
  
  idFields                  : string[]
  
  idFieldsOrdered           : string[]  
  
  optFields                 : string[] 
  
  config                    : ModelConfig

  nonSerializeFields        : string[]      
  
  // Rules to verify Array
  rules             : ((obj : object) => string) []

  private _rc       : RunContextServer

  public verify() {

  }

}


/**
 * All Methods are static 
 */
export class MasterRegistryMgr {

  static regMap : {[mastername : string] : MasterRegistry}

  static idField (mastername : string , prototype : any , propKey : string) : void {

  }

  static rules (mastername : string , rule : (obj : object) => string) : void {

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
