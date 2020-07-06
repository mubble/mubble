/*------------------------------------------------------------------------------
   About      : Initialize google-cloud with the respective credentials,
                with respect to the run mode
   
   Created on : Thu Feb 20 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import {
        RunContextServer,
        RUN_MODE,
       }                            from '../rc-server'
import {
        BigQueryClient
       }                            from '../index'
import { BigQuery }                 from '@google-cloud/bigquery'

export class GcloudEnv {

  public bigQuery : BigQuery

  public projectId           : string
  public credentialFilePath  : string
  
  constructor(public namespace : string) {
  }

  static async init(rc : RunContextServer, projectId: string, credentialsPath: string): Promise<GcloudEnv> {

    let gCloudEnv = new GcloudEnv(RUN_MODE[RUN_MODE.DEV])
    gCloudEnv.projectId = projectId
    gCloudEnv.credentialFilePath = credentialsPath
    
    await this.initGcpComponents(rc, gCloudEnv)
    return gCloudEnv
  }

  private static async initGcpComponents(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    await BigQueryClient.init(rc, gcloudEnv)
  }
}
