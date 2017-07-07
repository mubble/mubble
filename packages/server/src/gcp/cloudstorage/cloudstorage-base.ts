/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri May 26 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const cloudStorage : any = require('@google-cloud/storage')

import {RunContextServer}    from '../../rc-server'
import {GcloudEnv}           from '../../gcp/gcloud-env'
import {v4 as UUIDv4}        from 'uuid'

import * as mime             from 'mime-types'
import * as fs               from 'fs'

export class CloudStorageBase {

  static _cloudStorage : any

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

    this._cloudStorage = gcloudEnv.cloudStorage
  }

  static async uploadDataToCloudStorage(rc       : RunContextServer, 
                                        bucket   : string,
                                        path     : string,
                                        data     : any,
                                        mimeVal  : string,
                                        name    ?: string) : Promise<{fileUrl : string, filename : string}> {

    const extension = mime.extension(mimeVal),
          newName   = name ? name : await this.getFileName(rc, bucket, extension, path),
          filename  = name ? `${newName}_low` : `${newName}_high`,
          modPath   = (path) ? (path + '/') : '',
          res       = await fs.writeFileSync(`/tmp/${filename}.${extension}`, data, 'binary'),
          fileUrl   = await this.upload(rc, bucket, 
                                `/tmp/${filename}.${extension}`,
                                `${modPath}${filename}.${extension}`)
                       
    await fs.unlinkSync(`/tmp/${filename}.${extension}`)
   
    return {fileUrl : fileUrl ? `${newName}.${extension}` : '', filename : newName}
  }

  private static async getFileName(rc : RunContextServer, bucketName : string, extension : string | false, path : string) {
    let id = UUIDv4()

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

  static async upload(rc : RunContextServer, bucketName: string, filePath : string, destination : string) : Promise<string> {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          data   : any = await bucket.upload(filePath, {destination})
  
    return data[0].metadata.name.split('/')[1]
  }

  static async bucketExists(rc : RunContextServer, bucketName: string) {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          data   : any = await bucket.exists()

    return data[0]
  }

  static async fileExists(rc : RunContextServer, bucketName: string, filePath : string) {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          file   : any = bucket.file(filePath),
          data   : any = await file.exists()

    return data[0]
  }
}