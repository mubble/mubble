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
import * as stream           from 'stream'

export type GcsOptions = {
  bucket : string
  folder : string
  file  ?: string         // This is Mandatory for File Writing Operations.
}

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

  static async uploadDataToCloudStorage(rc         : RunContextServer, 
                                        bucketName : string,
                                        path       : string,
                                        data       : Buffer,
                                        mimeVal    : string,
                                        append    ?: string,
                                        name      ?: string) : Promise<{fileUrl : string, filename : string}> {

    const extension    = mime.extension(mimeVal),
          newName      = name ? name : await this.getFileName(rc, bucketName, extension, path),
          filename     = newName + append,
          modPath      = (path) ? (path + '/') : '',
          gcBucket     = CloudStorageBase._cloudStorage.bucket(bucketName),
          gcFile       = gcBucket.file(`${modPath}${filename}.${extension}`),
          bufferStream = new stream.PassThrough(),
          traceId : string = rc.getName(this)+':'+'uploadDataToCloudStorage',
          ack = rc.startTraceSpan(traceId)
          
    try{

      await new Promise((resolve, reject) => {
        bufferStream.end(data)
        bufferStream.pipe(gcFile.createWriteStream({metadata : {'Cache-Control': 'public, max-age=31536000'}}))
        .on('error', (err : any) => {reject(err)})
        .on('finish', () => {resolve()})
      })
    }finally{
      rc.endTraceSpan(traceId,ack)
    }
    return {fileUrl : `${newName}.${extension}`, filename : newName}
  }

  static async getFileName(rc : RunContextServer, bucketName : string, extension : string | false, path : string) {
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
          data   : any = await bucket.upload(filePath, {  
                                                         destination : destination, 
                                                         metadata    : {'Cache-Control': 'public, max-age=31536000'}
                                                       })
  
    return data[0].metadata.name.split('/')[1]
  }

  static async download(rc : RunContextServer, bucketName : string, filePath : string) : Promise<any> {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          file   : any = bucket.file(filePath)

    let data : any
    return new Promise((resolve, reject) => {
      const readStream = file.createReadStream()

      readStream.on('error', (err : any) => {
        reject(err)
      })
      readStream.on('data', (response : any) => {
        data = data ? Buffer.concat([data, response]) : response
      })
      readStream.on('end', function() {
        resolve(data)
      })
    })
    
  }

  static async bucketExists(rc : RunContextServer, bucketName : string) {
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