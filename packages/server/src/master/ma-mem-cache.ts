/*------------------------------------------------------------------------------
   About      : Master In Memory cache class required for destination sync
   
   Created on : Mon Jun 12 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


export class MasterInMemCache {
  
  public records    : object [] = []
  public modTSField : string

  public getMaxTS() : number {
    return 0
  } 
  public getMinTS() : number {
    return 0
  }

  public refTS          : number
  public lastUpdateTS   : number
  public digest         : string

  public constructor(public mastername : string , public cache : boolean) {
    
  }

}
