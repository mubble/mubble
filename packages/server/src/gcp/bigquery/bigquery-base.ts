/*------------------------------------------------------------------------------
   About      : Initialize google-cloud with the respective credentials
   
   Created on : Thu Feb 20 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer } from "../../rc-server"
import { BigQuery }         from '@google-cloud/bigquery'
import { GcloudEnv }        from "../gcloud-env"

export class BigQueryBase {

          static _bigQuery   : BigQuery
  private static initialized : boolean = false

  constructor(rc: RunContextServer) {}

  public static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {

    if(this.initialized) {
      rc.isError() && rc.error(rc.getName(this), 'Calling init twice.')
      throw new Error('Calling init twice.')
    }

    gcloudEnv.bigQuery = new BigQuery({ 
      projectId   : gcloudEnv.projectId, 
      keyFilename : gcloudEnv.credentialFilePath
    })

    this._bigQuery    = gcloudEnv.bigQuery
    this.initialized  = true
  }

}