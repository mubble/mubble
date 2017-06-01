/*------------------------------------------------------------------------------
   About      : Base class to be used to persist data in redis and master data verification
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {RedisWrapper} from './redis-wrapper'
import {RunContextServer} from '../rc-server'


export type IDType =  object | number | string

export function modelType(config : ModelConfig) {
  return function(target : any){
      // Make Registry of all the models here
  }
}

// Check if these are required or not
export enum MasterFieldType {
  MANDATORY ,
  OPTIONAL ,
  AUTO 
}

export function field(types ?: MasterFieldType ) {
  return function(target : any , propertyKey : string) {

  }
}

export function primaryKey() {
  return function(target: any, propertyKey: string) {
    
  }
}

export function ValidityRule(validFromFld : string , validTillFld : string) {
  
  return function(target : any){
      
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

function getDefaultConfig (segment : object , startVersion : string , endVersion : string , fk ?: ForeignKeys )  : ModelConfig {
  return {segment : segment , startVersion : startVersion , endVersion : endVersion , fkConstrains : fk}
}


export class RedisBase {

  @field()
  public insertTS : number
  
  @field()
  public modTS  : number
  
  /*
  @field()
  public modUid  : number
  
  @field()
  public modLoc  : number
  */
  
  @field()
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
  public getId() : IDType {
    return {}
  }
  
  public getIdFromObj(src : object) : IDType {
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
  async get(id : IDType) {

  }

  async insert() {

  }

  async  update(selectCrit : object ) : Promise<any> {

  }

  async remove(id ?: IDType) {}

  
  async list(selectCrit : object) : Promise<Array<RedisBase>> {
    return Promise.resolve([])
  }

  async count (selectCrit : object) : Promise<number> {
    return Promise.resolve(1)
  }

  verify (rc : RunContextServer , oldObj : object , nObj : object) : boolean {
    return true
  }

  // Bulk apis
  
}

export class MasterBase extends RedisBase {

  constructor(context : RunContextServer , master : string){
    super(context , master)
  }

  // Each master can override this
  public verifyAllDependency (context : RunContextServer , masterCache : Map<string , {[pk : string] : object}> ) : (string | undefined) {
    return 
  }

}

@modelType(getDefaultConfig({} , '2.3.4' , '3.5.6'))
class operator extends MasterBase {
  @primaryKey()
  name : string
}

@modelType(getDefaultConfig({} , '2.3.4' , '3.5.6'))
class circle extends MasterBase {
  @primaryKey()
  name : string
}

@modelType(getDefaultConfig ({} , '2.3.4' , '3.5.6' , 
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   
  }
))

class operatorcircle extends MasterBase {
  @primaryKey()
  operator : string
  
  @primaryKey()
  circle   : string 
}

@modelType(getDefaultConfig ({} , '2.3.4' , '3.5.6' , 
  
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   ,
    operatorcircle   : {operator : 'operator' , circle : 'circle'}
  }

))
class SampleOperatorPlan extends MasterBase {

  // Please declare your primary keys first
  // ensure that you observe the order of keys
  // order of keys once declared cannnot be changed

  
  @primaryKey()
  public operator : string
  
  @primaryKey()
  public circle : string
  
  @primaryKey()
  public rc       : number
  
  @primaryKey()
  public mode     : string

  @field()
  public currentPlan : object 
  
  @field(MasterFieldType.OPTIONAL)
  public currentPlanEdited : object 

  @field()
  public validFrom : number
  
  @field()
  public validTill : number


}




