/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri May 26 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const cloudStorage : any = require('@google-cloud/storage')

import {RunContextServer}                        from '../../rc-server'
import {GcloudEnv}                               from '../../gcp/gcloud-env'
import {Mubble}                                  from '@mubble/core'
import {v4 as UUIDv4}                            from 'uuid'
import * as mime                                 from 'mime-types'
import * as stream                               from 'stream'

export type GcsUUIDFileInfo = { // Pattern => ${Prefix}${UUID}${Suffix}.${Extension}
  bucket      : string
  folder      : string
  namePrefix  : string
  fileId     ?: string   // Optional. Will be generated (if missing)
  nameSuffix  : string
  mimeVal     : string   // Used to determine the File Extension
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

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */  

  static async uploadDataToCloudStorage(rc : RunContextServer, dataStream : stream.PassThrough, fileInfo : GcsUUIDFileInfo) : Promise<string> {
    const filename = await this.getUUIDFileName(rc, fileInfo),
          gcFile   = CloudStorageBase._cloudStorage.bucket(fileInfo.bucket).file(filename),
          traceId  = `UploadDataToCloudStorage : ${filename}`,
          ack      = rc.startTraceSpan(traceId)
          
    try {
      await new Promise((resolve, reject) => {
        dataStream.pipe(gcFile.createWriteStream({
          resumable  : false,
          validation : false,
          metadata   : {'Cache-Control': 'public, max-age=31536000'}
        }))
        .on('error', (error : Error) => { 
          rc.isError() && rc.error (rc.getName(this), 'GCS Write Stream :', JSON.stringify(fileInfo), 'Error :', error)
          reject(error) 
        })
        .on('finish', () => { 
          rc.isDebug() && rc.debug (rc.getName (this), `Uploaded ${filename} to Cloud Storage.`)
          resolve(true)
         })
      })
    } finally { 
      rc.endTraceSpan(traceId, ack)
    }

    return this.getFileNameFromInfo(rc, fileInfo)
  }

  static async getUUIDFileId(rc : RunContextServer, fileInfo: GcsUUIDFileInfo) {
    if(fileInfo.fileId) return fileInfo

    const traceId = rc.getName(this) + ':' + 'getUUIDFileId',
          ack     = rc.startTraceSpan(traceId)

    try {
      while (true) {
        fileInfo.fileId = UUIDv4()

        const filePath = this.getFilePathFromInfo (rc, fileInfo),
              exists   = await this.fileExists (rc, fileInfo.bucket, filePath)

        if(!exists) return fileInfo
      }
    } finally {
      rc.endTraceSpan(traceId , ack)
    }      
  }

  private static async getUUIDFileName(rc : RunContextServer, fileInfo: GcsUUIDFileInfo) {
    if(fileInfo.fileId) return this.getFilePathFromInfo (rc, fileInfo)

    const traceId = rc.getName(this) + ':' + 'getUUIDFileName',
          ack     = rc.startTraceSpan(traceId)

    try {
      while(true) {
        fileInfo.fileId = UUIDv4()

        const filePath = this.getFilePathFromInfo (rc, fileInfo),
              exists   = await this.fileExists (rc, fileInfo.bucket, filePath)

        if(!exists) return filePath
      }
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  private static getFilePathFromInfo (rc: RunContextServer, fileInfo: GcsUUIDFileInfo) {
    return fileInfo.folder + '/' + this.getFileNameFromInfo (rc, fileInfo)
  }
    
  private static getFileNameFromInfo (rc: RunContextServer, fileInfo: GcsUUIDFileInfo) {
    const extension = mime.extension(fileInfo.mimeVal),
          basename  = `${fileInfo.namePrefix || ''}${fileInfo.fileId}${fileInfo.nameSuffix || ''}`

    return (extension ? (basename + '.' + extension) : basename)
  }
    
  static async upload(rc : RunContextServer, bucketName : string, filePath : string, destination : string) : Promise<string> {
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
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          file    : any    = bucket.file(filePath),
          traceId : string = rc.getName(this) + ':' + 'download',
          ack              = rc.startTraceSpan(traceId)

    try {
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
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
    
  }

  static async bucketExists(rc : RunContextServer, bucketName : string) {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          traceId : string = rc.getName(this) + ':' + 'bucketExists',
          ack              = rc.startTraceSpan(traceId)

    try {
      const data : any = await bucket.exists()
      return data[0]
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  static async fileExists(rc : RunContextServer, bucketName: string, filePath : string) {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          file    : any    = bucket.file(filePath),
          traceId : string = rc.getName(this) + ':' + 'fileExists',
          ack              = rc.startTraceSpan(traceId)

    try {
      const data : any = await file.exists()
      return data[0]
    } finally {
      rc.endTraceSpan(traceId, ack)
    }          
  }

  static async getFileList(rc : RunContextServer, bucketName : string, prefix ?: string, delimiter ?: string) {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          options : any    = {},
          traceId : string = rc.getName(this) + ':' + 'getFiles',
          ack              = rc.startTraceSpan(traceId)

    /*
      delimiter - Results will contain only objects whose names, aside from the prefix, do not contain delimiter. 
      Objects whose names, aside from the prefix, contain delimiter will have their name truncated after the delimiter, 
      returned in apiResponse.prefixes. Duplicate prefixes are omitted.

      prefix - Filter results to objects whose names begin with this prefix.
    */
    try {
      if(prefix) options.prefix = prefix
      if(delimiter) options.delimiter = delimiter

      const data : any = await bucket.getFiles(options)
      return data[0]
    } finally {
      rc.endTraceSpan(traceId, ack)
    }          
  }

  static async getFileBuffer(rc: RunContextServer, bucketName : string, filename : string) : Promise<Buffer> {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          gcFile  : any    = bucket.file (filename),
          traceId  = `UploadDataToCloudStorage : ${filename}`,
          ack      = rc.startTraceSpan(traceId)
          
    try {
      let data : any = []
      const response = await new Promise ((resolve, reject) => {
        gcFile.createReadStream({ })
        .on('error', (error : Error) => { 
          rc.isError() && rc.error (rc.getName(this), 'GCS Read Stream :', bucketName + '/' + filename, 'Error :', error)
          reject(error) 
        })
        .on('data', (chunk: any) => {
            data.push (chunk)
        })
        .on('finish', () => { 
          rc.isDebug() && rc.debug (rc.getName (this), `Downloaded ${filename} from Cloud Storage.`)
          resolve(Buffer.concat(data))
        })
      })
      return response as Buffer
    } finally { 
      rc.endTraceSpan(traceId, ack)
    }
  }

  static async setMetadata(rc: RunContextServer, bucketName: string, filename: string, metaKey: string, metaValue: string) {
    const bucket  : any    = CloudStorageBase._cloudStorage.bucket(bucketName),
          gcFile  : any    = bucket.file (filename)
    if (gcFile) {
      const metadata    : any = {}
      metadata[metaKey] = metaValue
      const metaInfo = await gcFile.setMetadata ({ metadata: metadata })
      if (metaInfo && metaInfo.length > 0) return metaInfo[0].metadata
    }
    return null
  } 

  static getProjectId(rc: RunContextServer) {
    return this._cloudStorage.projectId
  }
}