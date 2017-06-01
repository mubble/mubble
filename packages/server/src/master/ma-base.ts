/*------------------------------------------------------------------------------
   About      : Base class to be used to persist data in redis and master data verification
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RedisWrapper} from './redis-wrapper'
import {RunContextServer} from '../rc-server'

export namespace Master{

  export type IDType =  object | number | string

  export function modelType(config : ModelConfig) {
    return function(target : any){
        // Make Registry of all the models here
    }
  }

  // Check if these are required or not
  export enum FieldType {
    MANDATORY ,
    OPTIONAL ,
    AUTO 
  }

  export function field(types ?: FieldType ) {
    return function(target : any , propertyKey : string) {

    }
  }

  export function primaryKey() {
    return function(target: any, propertyKey: string) {
      
    }
  }

  export function validityRule(validFromFld : string , validTillFld : string) {
    
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






