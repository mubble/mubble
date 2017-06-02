/*------------------------------------------------------------------------------
   About      : Base class to be used to persist data in redis and master data verification
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

//import {RedisWrapper}       from './redis-wrapper'
import {RunContextServer}     from '../rc-server'
import {MasterRegistryMgr}    from './ma-reg-manager'
import {assert , masterDesc,
        log , concat}       from './ma-util'

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

  // Check if these are required or not
  export enum FieldType {
    PRIMARY ,
    MANDATORY ,
    OPTIONAL ,
    AUTO 
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
    return function(rec : any) {
      const mastername : string = prototype.constructor.name
      const val : number = rec[propKey]

      // Todo : use lodash for version parsing
    } 
    
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
  
  export function objPropertiesIn(list : any[]) {
    return function(prototype : any , propKey : string) {

    }
  }

  export function objectStructure(struc : any) {
    return function(prototype : any , propKey : string) {

    }
  }
  
  export function inRange(minVal : number , maxVal : number , defaultIgnoreVal ?: number) {
    return function(prototype : any , propKey : string) {
      
      function inRangeCheck(rec : any) {
        const mastername : string = prototype.constructor.name
        const val : number = rec[propKey]
        if(defaultIgnoreVal!=null && val===defaultIgnoreVal) return
        assert( val>=minVal && val<=maxVal , masterDesc(mastername,propKey,val) , 'not in range', minVal , maxVal )
      } 
      MasterRegistryMgr.fieldValidationRule(prototype , propKey , inRangeCheck)
    }
  }
  

  export type ForeignKeys = {[master : string] : {[masterField : string] : string }}

  export interface ModelConfig {
    cache                 ?: boolean 
    segment               ?: object  
    startVersion          ?: string  
    endVersion            ?: string
    fkConstrains          ?: ForeignKeys
    dependencyMasters     ?: string []
    masterTsField         ?: string
    cachedFields          ?: {fields :  string [] , cache : boolean}
    destSynFields         ?: {fields :  string [] , cache : boolean} 
    validationrules       ?: ((rec : object)=> string)[]
  }

  export function getDefaultConfig (segment : object , startVersion : string , endVersion : string , fk ?: ForeignKeys )  : ModelConfig {
    return {segment : segment , startVersion : startVersion , endVersion : endVersion , fkConstrains : fk}
  }

}

export class MasterBase {

  @Master.field()
  public insertTS : number
  
  @Master.field()
  public modTS  : number
  
  /*
  @field()
  public modUid  : number
  
  @field()
  public modLoc  : number
  */
  
  @Master.field()
  public deleted : boolean
  
  public _mastername : string
  
  public _rc         : RunContextServer
  

  constructor(context : RunContextServer , masterName : string){
    // RunContextServer should have the redis instance 
    this._rc = context
    this._mastername = masterName
  }

  /**
   * Get the Id (Primary key) of this model object. 
   * Will be calculated from the id fields provided.
   */
  public getId() : Master.IDType{
    return {}
  }
  
  public getIdFromObj(src : object) : Master.IDType {
    return {}
  }

  /**
   * Get (Hash) key for staorage in Redis for this master model
   */
  public getHashKey() : string {
    // Todo : define const for keys
    return 'MASTER_REDIS_'+'DATA'+'_'+this._mastername
  }
  
  /**
   * Load the model object from redis
   */
  async get(id : Master.IDType) {

  }

  async insert() {

  }

  async  update(selectCrit : object ) : Promise<any> {

  }

  async remove(id ?: Master.IDType) {}

  
  async list(selectCrit : object) : Promise<Array<object>> {
    return Promise.resolve([])
  }

  async count (selectCrit : object) : Promise<number> {
    return Promise.resolve(1)
  }

  verify (rc : RunContextServer , oldObj : object , nObj : object) : boolean {
    return true
  }

    // Each master can override this
  public verifyAllDependency (context : RunContextServer , masterCache : Map<string , {[pk : string] : object}> ) : (string | undefined) {
    return 
  }
  
}






