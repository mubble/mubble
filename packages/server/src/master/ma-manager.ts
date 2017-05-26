/*------------------------------------------------------------------------------
   About      : Manager class for master data (upload / sync)
   
   Created on : Thu May 25 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../rc-server'


export type masterdatainfo = {
  mastername : string 
  masterdata : string
}

export type syncInfo = {
  ts : number 
  // add more
}

export abstract class MasterMgr {


async abstract reloadFromRedis(rc : RunContextServer) : Promise<any> ;

async abstract verifyCacheFromRedis (rc : RunContextServer) : Promise<any> ;

async abstract applyMasterData (rc : RunContextServer , data : Array<masterdatainfo> ) : Promise<any> ;

async abstract destinationSync (rc : RunContextServer , sync : Array<syncInfo> ) : Promise<any> ;

}
