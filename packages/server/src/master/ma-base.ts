/*------------------------------------------------------------------------------
   About      : Base class to be used to persist data in redis and master data verification
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../rc-server'
import {MasterMgr} from './mastermgr'

export enum PKType {
  OBJECT ,
  SEQ ,
  CODE 
}

export type AsyncResp = {error : string , success : boolean , count ?: number}
export type IDType = string | object


export abstract class RedisBase {

  public _id : string | object  
  public insertTS : number
  public modTS  : number
  public deleted : boolean

  public _mastername : string 
  private _rc         : RunContextServer
  private _type       : PKType
  

  constructor(context : RunContextServer , name : string , pkType : PKType){
    // RunContextServer should have the redis instance 
  }


  async abstract get(id : IDType) : Promise<AsyncResp> ;

  async abstract insert() : Promise<AsyncResp> ;

  async abstract update(selectCrit : object ) : Promise<AsyncResp> ;

  async abstract remove(id ?: IDType) : Promise<AsyncResp> ;

  async abstract list(selectCrit : object) : Promise<Array<RedisBase>> ;

  async abstract count (selectCrit : object) : Promise<number> ;

  // Bulk apis
  
}

//export type MasterBaseName  = 'master1' | 'master2'

export abstract class MasterBase extends RedisBase {

  constructor(context : RunContextServer , name : string , pkType : PKType) {

    super(context , name , pkType)

  }

  public validateBeforeSourceSync (context: RunContextServer , mgr : MasterMgr ,  source : Array<JSON> , data : Array<MasterBase> ) : boolean {
    return true
  }

  public verifyRecords (context : RunContextServer , mgr : MasterMgr ,  source : Array<JSON>) : boolean {
    return true
  }



}




