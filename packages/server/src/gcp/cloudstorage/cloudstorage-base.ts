/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri May 26 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const cloudStorage : any = require('@google-cloud/storage')

import {RunContextServer} from '../../rc-server'
import {GcloudEnv}        from '../../gcp/gcloud-env'

export class CloudStorageBase {

  _cloudStorage : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.cloudStorage = cloudStorage ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.cloudStorage = cloudStorage ({
        projectId   : gcloudEnv.projectId
      })
    }
  }

  constructor(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    this._cloudStorage = gcloudEnv.cloudStorage
  }

  async upload(rc : RunContextServer, bucketName: string, filePath : string, destination : string) : Promise<string> {
    const bucket : any = this._cloudStorage.bucket(bucketName),
          data   : any = await bucket.upload(filePath, {destination})
  
    return data[0].metadata.mediaLink
  }

  async bucketExists(rc : RunContextServer, bucketName: string) {
    const bucket : any = this._cloudStorage.bucket(bucketName),
          data   : any = await bucket.exists()

    return data[0]
  }

  async fileExists(rc : RunContextServer, bucketName: string, filePath : string) {
    const bucket : any = this._cloudStorage.bucket(bucketName),
          file   : any = bucket.file(filePath),
          data   : any = await file.exists()

    return data[0]
  }
}