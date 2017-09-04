/*------------------------------------------------------------------------------
   About      : Google Pub-Sub Access
   
   Created on : Thu Jun 29 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const PubSub  : any       = require('@google-cloud/pubsub')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'

export interface NCPubSubSubscrption {
  
  get             : (options ?: {autoCreate : boolean}) => any[]
  removeListener  : (listner : string) => void
  exists          : ()=> any[]
  getMetadata     : ()=> any[]
  delete          : ()=> void
  pull            : (cb : any)=> void
}

export interface NCPubSubTopic {
  name      : string 
  get       : (options : {autoCreate : boolean}) => any[]
  /*
  exists    : ()=> any[]
  create    : (name : string) => any[]
  */
  subscription : (name : string) => NCPubSubSubscrption 
  publish   : (msg : string) => void
  subscribe : (name : string , options : subscribeOptions) => NCPubSubSubscrption
}

export type subscribeOptions = {
  pushEndpoint               : string 
  ackDeadlineSeconds        ?: number
  autoAck                   ?: boolean
  encoding                  ?: string
  interval                  ?: number 
  maxInProgress             ?: number
  timeout                   ?: number 
  messageRetentionDuration  ?: number
}

export type SubscriptionMeta  = {
  name        : string   // full name projects/mubble-ncprod/subscriptions/NC_SEO_SUBSCRIPTION
  topic       : string   // full name projects/mubble-ncprod/topics/NC_SEO_TOPIC
  pushConfig  : {
    pushEndpoint : string 
    attributes   : any 
  } 
  ackDeadlineSeconds : number 
  retainAckedMessages : boolean
  messageRetentionDuration : number | null
}

export class PubSubBase {

  static _pubSub : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.pubsub = PubSub ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.pubsub = PubSub ({
        projectId   : gcloudEnv.projectId
      })
    }

    this._pubSub = gcloudEnv.pubsub
  }

  /**
   * Get the existing created Topic or create a one if does not exists
   * @param rc 
   * @param topicName 
   */
  public static async getOrCreateTopic(rc : RunContextServer , topicName : string) : Promise<NCPubSubTopic> {
    rc.isDebug() && rc.debug(rc.getName(this), 'getOrCreateTopic',topicName)
    const topic : NCPubSubTopic =  PubSubBase._pubSub.topic(topicName)
    await topic.get({autoCreate : true})
    return topic
  }

  /**
   * 
   * @param rc 
   * @param topic     topic for which subscription needs to be created
   * @param subscriptionName  name of the subscription
   * @param pushEndPoint  push end point url . Must be https. Has to be registred with project
   * @param ackDeadLineSec The maximum time after receiving a message that you must ack/responde with 200 OK ,  a message before it is redelivered
   */
  public static async createSubscription(rc : RunContextServer , topic : NCPubSubTopic , subscriptionName : string , pushEndPoint : string , ackDeadLineSec ?: number) : Promise<NCPubSubSubscrption> {
    let subscription : NCPubSubSubscrption = topic.subscription(subscriptionName)

    const res: any = await subscription.exists()
    if(res[0]){
      rc.isDebug() && rc.debug(rc.getName(this), 'subscription already exists', subscriptionName)
      const metaRes  = await subscription.getMetadata(),
            meta : SubscriptionMeta  = metaRes[0]
      
      rc.isDebug() && rc.debug(rc.getName(this), 'meta is ',meta)

      const gcloud : GcloudEnv = rc.gcloudEnv, 
            projectBase = 'projects/'+ gcloud.projectId,
            topicFullName = topic.name ,
            subFullName   = projectBase + '/subscriptions/'+ subscriptionName 
      
      if(meta.topic !== topicFullName || 
        meta.name !== subFullName  || 
        !meta.pushConfig || 
        meta.pushConfig.pushEndpoint !== pushEndPoint || 
        meta.ackDeadlineSeconds !== (ackDeadLineSec || 10)) 
        {
          rc.isWarn() && rc.warn(rc.getName(this), 'subscription meta does not match deleting the old')
          await subscription.delete()
          rc.isWarn() && rc.warn(rc.getName(this), 'deleted subscription ')
        }else{
          rc.isDebug() && rc.debug(rc.getName(this), 'subscription detail match', subscription , pushEndPoint)
          return subscription
        }
    } 

    rc.isDebug() && rc.debug(rc.getName(this), 'Creating subscription ', subscriptionName , res)
    await topic.subscribe(subscriptionName , {pushEndpoint : pushEndPoint , ackDeadlineSeconds : ackDeadLineSec || 10 })
    subscription = topic.subscription(subscriptionName)  
    rc.isDebug() && rc.debug(rc.getName(this), 'subscription property ',subscription , pushEndPoint)
    return subscription
  }


}