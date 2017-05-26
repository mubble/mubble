/*------------------------------------------------------------------------------
   About      : Redis Instance wrapper
   
   Created on : Wed May 24 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RedisClient , createClient , ResCallbackT} from 'redis'

export type AsyncResp = {error : string , success : boolean}

export abstract class RedisInstance {

  private name    : string 
  private redis   : RedisClient 

  constructor(name : string ){
    this.name = name
    //this.redis = createClient(url)
    
  }

  /**
   * 
   * @param url 
   */
  async connect(url : string) : Promise <void> {

  }

  async abstract subscribe(args: any[] ): Promise<AsyncResp> ;

  async abstract scan (pattern : string , count : number) : Promise<any> ;

  // Make the returned promise result type
  async abstract hscan (key : string , pattern : string , count : number) : Promise<any> ;
  async abstract sscan (key : string , pattern : string , count : number) : Promise<any> ;
  async abstract zscan (key : string , pattern : string , count : number) : Promise<any> ;

  // Ignore
  test() : void {
    this.redis.subscribe()
    this.redis.scan
  }

}
