/*------------------------------------------------------------------------------
   About      : Google Pub-Sub Messages Util Apis
   
   Created on : Fri Sep 01 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {set}                        from '@mubble/core'


export type PubSubCbMsg = {
  message : {
    data          : string  // base 64 encoded data string
    attributes    : object  
    message_id    : string 
    messageId     : string 
    publish_time  : string 
    publishTime   : string 
  },
  subscription : string  // full subscription name

}

export class PubSubMsgDecoder {

  constructor(public msg : PubSubCbMsg){}

  public getJsonData<T>() : T {
    const res : any = JSON.parse(this.getStringData())
    return typeof(res) === 'string' ? JSON.parse(res) : res
  }

  public getStringData() : string {
    return new Buffer(this.msg.message.data , 'base64').toString()
  }

  public getPublishDate() : Date {
    const date = new Date()
    set(date , this.msg.message.publish_time , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%Z' , 0 )
    return date
  }
}

