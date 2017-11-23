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

export type GcsUUIDFileInfo = { // Pattern => ${Prefix}${UUID}${Suffix}.${Extension}
  bucket     : string
  folder     : string
  namePrefix : string
  fileId    ?: string   // Optional. Will be generated (if missing)
  nameSuffix : string
  mimeVal    : string   // Used to determine the File Extension
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

  static async uploadDataToCloudStorage(rc : RunContextServer, data : Buffer, fileInfo : GcsUUIDFileInfo) : Promise<string> {
    const filename     = await this.getUUIDFileName (rc, fileInfo),
          gcBucket     = CloudStorageBase._cloudStorage.bucket(fileInfo.bucket),
          gcFile       = gcBucket.file(filename),
          bufferStream = new stream.PassThrough(),
          traceId      = 'UploadDataToCloudStorage: ' + filename,
          ack          = rc.startTraceSpan(traceId)
    let   exists       = false
          
    try {
      await new Promise((resolve, reject) => {
        bufferStream.on('error', (err : any) => {
          rc.isError() && rc.error (rc.getName(this), 'uploadDataToCloudStorage: [Buffer Stream, length=' + data.length + ']', JSON.stringify(fileInfo), 'URL Info:', err)
          reject(err)
        }) 
        bufferStream.end(data)
        bufferStream.pipe(gcFile.createWriteStream({
          metadata : {'Cache-Control': 'public, max-age=31536000'}
        }))
        .on('error', (err : any) => { 
          rc.isError() && rc.error (rc.getName(this), 'uploadDataToCloudStorage: [GCS Write Stream, length=' + data.length + ']', JSON.stringify(fileInfo), 'URL Info:', err)
          reject(err) 
        })
        .on('finish', () => { 
          exists = true
          resolve()
         })
      })
    } finally { 
      if (rc.isDebug()) {
        // const exists = await CloudStorageBase.fileExists(rc, fileInfo.bucket, filename)
        rc.isDebug() && rc.debug (rc.getName (this), 'Uploaded', filename, 'to Datastore, [Size:', data.length, '], File Created:', exists)
      }
      rc.endTraceSpan(traceId,ack)
    }
    return this.getFileNameFromInfo(rc, fileInfo)
  }

  static async getUUIDFileId(rc : RunContextServer, fileInfo: GcsUUIDFileInfo) {
    if (fileInfo.fileId) return fileInfo
    const traceId : string = rc.getName(this)+':'+'getUUIDFileId',
          ack = rc.startTraceSpan(traceId)
    try{
      while (true) {
        fileInfo.fileId = UUIDv4()
        const filePath  = this.getFilePathFromInfo (rc, fileInfo)
        const exists    = await this.fileExists (rc, fileInfo.bucket, filePath)
        if (!exists) return fileInfo
      }
    }finally{
      rc.endTraceSpan(traceId , ack)
    }      
  }

  private static async getUUIDFileName(rc : RunContextServer, fileInfo: GcsUUIDFileInfo) {
    if (fileInfo.fileId) return this.getFilePathFromInfo (rc, fileInfo)
    const traceId : string = rc.getName(this)+':'+'getUUIDFileName',
    ack = rc.startTraceSpan(traceId)
    try{
      while (true) {
        fileInfo.fileId = UUIDv4()
        const filePath  = this.getFilePathFromInfo (rc, fileInfo)
        const exists    = await this.fileExists (rc, fileInfo.bucket, filePath)
        if (!exists) return filePath
      }
    }finally{
      rc.endTraceSpan(traceId,ack)
    }
  }

  private static getFilePathFromInfo (rc: RunContextServer, fileInfo: GcsUUIDFileInfo) {
    return fileInfo.folder + '/' + this.getFileNameFromInfo (rc, fileInfo)
  }
    
  private static getFileNameFromInfo (rc: RunContextServer, fileInfo: GcsUUIDFileInfo) {
    const extension    = mime.extension(fileInfo.mimeVal)
    const basename     = `${fileInfo.namePrefix}${fileInfo.fileId}${fileInfo.nameSuffix}`
    return (extension ? (basename + '.' + extension) : basename)
  }
    
  static async getFileName(rc : RunContextServer, bucketName : string, path : string, extension : string | false) {
    // TODO: THis filePath check is buggy for file names with append (_16x9...)
    let id = UUIDv4()
    const traceId : string = rc.getName(this)+':'+'getFileName',
    ack = rc.startTraceSpan(traceId)
    try{
      while(true) {
        const filePath = `${path}/${id}.${extension}`,
              res      = await this.fileExists(rc, bucketName, filePath)
        if(res) {
          id = UUIDv4()
        } else {
          return id
        }
      }
    }finally{
      rc.endTraceSpan(traceId,ack)
    }
  }

  static async upload(rc : RunContextServer, bucketName: string, filePath : string, destination : string) : Promise<string> {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          traceId : string = rc.getName(this) + ':' + 'upload',
          ack              = rc.startTraceSpan(traceId)
    try {
      const data : any = await bucket.upload(filePath, {  
        destination : destination, 
        metadata    : {'Cache-Control': 'public, max-age=31536000'}
      })

      return data[0].metadata.name.split('/')[1]
    } finally {
      rc.endTraceSpan(traceId,ack)
    }      
  }

  static async download(rc : RunContextServer, bucketName : string, filePath : string) : Promise<any> {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          file   : any = bucket.file(filePath),
          traceId : string = rc.getName(this)+':'+'download',
          ack = rc.startTraceSpan(traceId)
    try{
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
    }finally{
      rc.endTraceSpan(traceId,ack)
    }
    
  }

  static async bucketExists(rc : RunContextServer, bucketName : string) {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          traceId : string = rc.getName(this)+':'+'bucketExists',
          ack = rc.startTraceSpan(traceId)
    try{
      const data   : any = await bucket.exists()
      return data[0]
    }finally{
      rc.endTraceSpan(traceId,ack)
    }
  }

  static async fileExists(rc : RunContextServer, bucketName: string, filePath : string) {
    const bucket : any = CloudStorageBase._cloudStorage.bucket(bucketName),
          file   : any = bucket.file(filePath),
          traceId : string = rc.getName(this)+':'+'fileExists',
          ack = rc.startTraceSpan(traceId)
    try{
      const data   : any = await file.exists()
      return data[0]
    }finally{
      rc.endTraceSpan(traceId,ack)
    }          
  }
}