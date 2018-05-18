/*------------------------------------------------------------------------------
   About      : Azure Blob Storage Base
   
   Created on : Wed May 16 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}   from '../../rc-server'
import * as storage         from 'azure-storage'
import * as mime            from 'mime-types'
import * as stream          from 'stream'

export type AbsFileInfo = { // Pattern => ${Prefix}${UUID}${Suffix}.${Extension}
  container   : string
  folder      : string
  namePrefix  : string
  blobId      : string   // Optional. Will be generated (if missing)
  nameSuffix  : string
  mimeVal     : string   // Used to determine the File Extension
}

export class BlobStorageBase {
  static _blobstorage : storage.BlobService

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
  static init(rc : RunContextServer, connString : string) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Initializing Azure Blob Storage Service.')
    this._blobstorage = storage.createBlobService(connString)
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
  static async uploadDataToBlobStorage(rc : RunContextServer, dataStream : stream.PassThrough, fileInfo : AbsFileInfo) {
    const fileName = this.getFilePath(rc, fileInfo),
          traceId  = `uploadDataToBlobStorage : ${fileName}`,
          ack      = rc.startTraceSpan(traceId)

    try {
      await new Promise((resolve, reject) => {
        dataStream.pipe(this._blobstorage.createWriteStreamToBlockBlob(fileInfo.container, fileName, (error : Error, result : any, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in creating Azure Block Service write stream (${fileName}) : ${error.message}.`)
            reject(error)
          }
          if(response.isSuccessful) {
            rc.isStatus() && rc.status(rc.getName(this), `Succesfully uploaded ${fileName} to Azure Blob Storage.`)
            resolve(true)
          }
          resolve(false)
        }))
      })
    } finally {
      rc.endTraceSpan(traceId, ack)
    }

    return this.getFileName(rc, fileInfo)
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        INTERNAL FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
  private static getFilePath(rc : RunContextServer, fileInfo : AbsFileInfo) {
    return fileInfo.folder + '/' + this.getFileName(rc, fileInfo)
  }
  private static getFileName(rc : RunContextServer, fileInfo : AbsFileInfo) {
    const extension = mime.extension(fileInfo.mimeVal),
          basename  = `${fileInfo.namePrefix || ''}${fileInfo.blobId}${fileInfo.nameSuffix || ''}`

    return (extension ? (basename + '.' + extension) : basename)
  }
}
