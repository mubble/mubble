/*------------------------------------------------------------------------------
   About      : Google BigQuery Access
   
   Created on : Mon Jun 26 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const BigQuery  : any    = require('@google-cloud/bigquery')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'

export class BigQueryBase {

  static _bigQuery : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv, bqEnv ?: any) {
    if (gcloudEnv.authKey) {
      gcloudEnv.bigQuery = BigQuery ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      if (bqEnv) {
        gcloudEnv.bigQuery = BigQuery ({
          projectId   : bqEnv.PROJECT_ID,
          credentials : bqEnv.CREDENTIALS
        })
      } else {
        gcloudEnv.bigQuery = BigQuery ({
          projectId   : gcloudEnv.projectId
        })
      }
    }

    this._bigQuery = gcloudEnv.bigQuery
  }

}