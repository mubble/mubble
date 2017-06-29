/*------------------------------------------------------------------------------
   About      : Google Pub-Sub Access
   
   Created on : Thu Jun 29 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const PubSub  : any       = require('@google-cloud/pubsub')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'

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
      gcloudEnv.bigQuery = PubSub ({
        projectId   : gcloudEnv.projectId
      })
    }

    this._pubSub = gcloudEnv.pubsub
  }

}