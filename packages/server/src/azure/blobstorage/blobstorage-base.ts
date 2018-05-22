/*------------------------------------------------------------------------------
   About      : Azure Blob Storage Base
   
   Created on : Wed May 16 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}   from '../../rc-server'
import * as storage         from 'azure-storage'
import * as mime            from 'mime-types'
import * as stream          from 'stream'
import * as path            from 'path'   

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
  static async uploadDataToBlobStorage(rc : RunContextServer, dataStream : stream.Readable, 
                                       fullPath: string, fileName: string, mimeType: string) {

    const traceId  = `uploadDataToBlobStorage : ${fileName}`,
          ack      = rc.startTraceSpan(traceId)

    try {
      await new Promise((resolve, reject) => {
        const pathArr   = fullPath.split('/'),
              container = pathArr.shift() as string,
              filePath  = `${pathArr.join('/')}/${fileName}`

        dataStream.pipe(this._blobstorage.createWriteStreamToBlockBlob(container, filePath, (error : Error, result : any, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in creating Azure Block Service write stream (${fileName}) : ${error.message}.`)
            reject(error)
          }
          if(response.isSuccessful) {
            rc.isStatus() && rc.status(rc.getName(this), `Succesfully uploaded ${fileName} to Azure Blob Storage`, result, response)
            resolve(true)
          }
          resolve(false)
        }))
      })
    } finally {
      rc.endTraceSpan(traceId, ack)
    }

    return path.join(fullPath, fileName)
  }

}