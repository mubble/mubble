/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri May 26 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const cloudStorage : any = require('@google-cloud/storage')

import {RunContextServer}    from '../../rc-server'
import {GcloudEnv}           from '../../gcp/gcloud-env'
import {v4 as UUIDv4}        from 'node-uuid'

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

  async getFileName(rc : RunContextServer, bucketName : string, extension : string | false, path : string) {
    let id        = UUIDv4()

    while(true) {
      const filePath = `${path}/${id}.${extension}`,
            res      = await this.fileExists(rc, bucketName, filePath)
      if(res) {
        id = UUIDv4()
      } else {
        return id
      }
    }
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