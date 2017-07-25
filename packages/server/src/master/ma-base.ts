/*------------------------------------------------------------------------------
   About      : Base class to be used to persist data in redis and master data verification
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                from 'lodash'
import * as semver            from 'semver'


import {RunContextServer}     from '../rc-server'
import {ModelConfig, 
   MasterModelConfig}         from './ma-model-config'  
import {MasterRegistryMgr}    from './ma-reg-manager'
import {assert , masterDesc,
        log , concat ,
        MaType      }         from './ma-util'
import {Mubble}               from '@mubble/core' 
import {MasterCache}          from './ma-types'                                    

const LOG_ID : string = 'MasterBase'
function mbLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}
 
export namespace Master{

  export type IDType =  object | number | string

  export function modelType(config : ModelConfig) {
    return function(target : any){
        // Make Registry of all the models here
        MasterRegistryMgr.addMaster(target , config)
    }
  }

  export enum FieldType {
    
    PRIMARY = 1,
    MANDATORY ,
    OPTIONAL 
    //AUTO
  }





  export function field(type ?: FieldType ) {
    
    return function(target : any , propertyKey : string) {
      if(!type) type = FieldType.MANDATORY
      MasterRegistryMgr.masterField(target , propertyKey , type)
    }
  }

  export function primaryKey() {
    
    return function(target: any, propertyKey: string) {
      MasterRegistryMgr.masterField(target , propertyKey , FieldType.PRIMARY)
    }
  }

  // Class level rule
  export function validityRule(validFromFld : string , validTillFld : string) {
    
    return function(target : any){
        
    }
  }
  
  // field level Rule
  export function versionField(prototype : any , propKey : string) {
    
    function versionFieldCheck(rec : any) {
      const mastername : string = prototype.constructor.name
      const val : any = rec[propKey]
      assert( !val || semver.valid(val)!=null , masterDesc(mastername,propKey,val) , 'is not a version field' )
    }

    MasterRegistryMgr.fieldValidationRule(prototype , propKey , versionFieldCheck)
  }
  
  export function withinList(list : any[]) {
    
    return function(prototype : any , propKey : string) {
      
      function withinListCheck(rec : any) {
        const mastername : string = prototype.constructor.name
        const val : any = rec[propKey]
        assert( val!=null , masterDesc(mastername,propKey,val) , 'is null')
        assert( list.indexOf(val)!= -1 , masterDesc(mastername,propKey,val) , 'not in list', list.toString() )
      }

      MasterRegistryMgr.fieldValidationRule(prototype , propKey , withinListCheck)
    }
  }
  
  export function objPropertiesIn(list : string[]) {
    
    return function(prototype : any , propKey : string) {
      
      assert(list.length >0 ,'Object Properties is empty' )
      
      function objPropertiesInCheck(rec : any) {
        const mastername : string = prototype.constructor.name
        const val : any = rec[propKey]
        
        assert( MaType.isObject(val)!=null , masterDesc(mastername,propKey,val) , 'is not an object')
        for(const key of Object.keys(val)){
          assert(list.indexOf(key)!==-1 , masterDesc(mastername,propKey,val) , 'key:',key , 'is missing in the properties list',list)
        }
      }

      MasterRegistryMgr.fieldValidationRule(prototype , propKey , objPropertiesInCheck)
    }
  }

  export function objectStructure(struc : any) {
    
    return function(prototype : any , propKey : string) {
      
      function objectStructureCheck(rec : any) {
        const mastername : string = prototype.constructor.name
        const val : any = rec[propKey]
        assert( val!=null , masterDesc(mastername,propKey,val) , 'is null')
        // This is wrong. Have to check each field manually , recursively
        //assert( val instanceof struc , masterDesc(mastername,propKey,val) , 'is null')  
      }

      MasterRegistryMgr.fieldValidationRule(prototype , propKey , objectStructureCheck)
    }
  }
  
  export function inRange(minVal : number , maxVal : number , defaultIgnoreVal ?: number) {
    
    return function(prototype : any , propKey : string) {
      
      function inRangeCheck(rec : any) {
        const mastername : string = prototype.constructor.name
        const val : number = rec[propKey]
        if(defaultIgnoreVal!=null && val===defaultIgnoreVal) return
        assert( val>=minVal && val<=maxVal , masterDesc(mastername,propKey,val) , 'Not in range', minVal+'-'+maxVal , rec )
      } 

      MasterRegistryMgr.fieldValidationRule(prototype , propKey , inRangeCheck)
    }
  }
  

  export type ForeignKeys = Mubble.uObject<Mubble.uObject<string>> 
  

  export function getDefaultConfig (segment ?: {key : string , cols : string[]}  , fk ?: ForeignKeys )  : ModelConfig {
    //const masConfig : ModelConfig = new MasterModelConfig('Sample')
    
    const masConfig : ModelConfig = new class TestModelConfig extends MasterModelConfig {
      constructor(){
        super('Sample')
        this.segment = segment
        if(MaType.isObject(fk)) this.fkConstrains = fk
        this.hasFileSource = true
        this.cache = true
      }
    }
    //return {segment : segment , startVersion : startVersion , endVersion : endVersion , fkConstrains : fk }
    return masConfig
  }
}

export var MasterBaseFields =
{
  Deleted   : 'deleted' ,
  CreateTs  : 'createTs' ,
  ModTs     : 'modTs'
}

export class MasterBase {

  @Master.field()
  public createTs : number
  
  @Master.field()
  public modTs  : number
  
  @Master.field()
  public deleted : boolean
  
  public _mastername : string
  
  public _rc         : RunContextServer
  

  constructor(context : RunContextServer , masterName : string){
    // RunContextServer should have the redis instance 
    this._rc = context
    this._mastername = masterName
  }

  verifyRecord (rc : RunContextServer , newObj : object , oldObj ?: object) {
    return true
  }

  // Each master can override this
  public verifyAllDependency (context : RunContextServer , masterCache : MasterCache ) : (string | undefined) {
    return 
  }

  public syncGetModifications (context : RunContextServer , oRet : {mod : any[] , del : any[]}) : {mod : any[] , del : any[]} {
    return oRet
  }

  public matchSegment(context : RunContextServer, arClientSeg : any[][] , colSeg : string[] , rec : any) : boolean {
    return true
  } 

  // not used - remove
  /*
  public prepareSource(context : RunContextServer , rec : any){

  }
  */

}






