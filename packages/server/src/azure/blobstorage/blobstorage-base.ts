/*------------------------------------------------------------------------------
   About      : Azure Blob Storage Base
   
   Created on : Wed May 16 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}   from '../../rc-server'
import {Mubble}             from '@mubble/core' 
import * as storage         from 'azure-storage'
import * as mime            from 'mime-types'
import * as stream          from 'stream'

export class BlobStorageBase {
  static _blobstorage : storage.BlobService

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  Read the documentation at:
  home: http://azure.github.io/azure-storage-node/
  class BlobService: http://azure.github.io/azure-storage-node/BlobService.html

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

    const traceId   = `uploadDataToBlobStorage : ${fileName}`,
          ack       = rc.startTraceSpan(traceId),
          pathArr   = fullPath.split('/'),
          container = pathArr.shift() as string,
          filePath  = `${pathArr.join('/')}/${fileName}`

    try {
      await new Promise((resolve, reject) => {
        dataStream.pipe(this._blobstorage.createWriteStreamToBlockBlob(container, filePath, (error : Error, result : storage.BlobService.BlobResult, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in creating Azure Blob Service write stream (${filePath}) : ${error.message}.`)
            reject(error)
          }
          if(response.isSuccessful) {
            rc.isStatus() && rc.status(rc.getName(this), `Succesfully uploaded ${fileName} to Azure Blob Storage.`)
            resolve(true)
          }
          resolve(false)
        }))
      })
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Error in uploading file (${filePath}) to Azure Blob Storage : ${err}.`)
    } finally {
      rc.endTraceSpan(traceId, ack)
    }

    return filePath
  }

  static getWriteStream(rc: RunContextServer, container: string, file: string) {
    return this._blobstorage.createWriteStreamToBlockBlob(container, file)
  }

  static async listFiles(rc: RunContextServer, container: string, prefix ?: string) {

    const BS = this._blobstorage,
          fn = prefix ? BS.listBlobsSegmentedWithPrefix.bind(BS, container, prefix)
                      : BS.listBlobsSegmented.bind(BS, container),
          list: string[] = []
    
    let token = null
    do  {
      token = await this.listFilesInternal(fn, list, token)
      token && rc.isDebug() && rc.debug(rc.getName(this), 'Continuing... Current length', list.length)
    } while (token)

    return list
  }

  private static async listFilesInternal(fn: any, list: string[], token : any) {
    const result = await Mubble.uPromise.execFn(fn, null, token, {
      maxResults: 5000
    })
    list.push(...result.entries.map((item: any) => item.name))
    return result.continuationToken
  }

  static async setMetadata(rc : RunContextServer, container : string, fileName : string, metaKey : string, metaValue : string) {
    const traceId                                = `setMetadata : ${fileName} | ${metaKey} : ${metaValue}`,
          ack                                    = rc.startTraceSpan(traceId),
          metadata : {[index : string] : string} = {}

    metadata[metaKey] = metaValue

    try {
      return await new Promise((resolve, reject) => {
        this._blobstorage.setBlobMetadata(container, fileName, metadata, (error : Error, result : storage.BlobService.BlobResult, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in setting blob ${fileName} metadata (${metaKey} : ${metaValue}) : ${error.message}.`)
            reject(error)
          }
  
          if(response.isSuccessful) rc.isStatus() && rc.status(rc.getName(this), `Succesfully set blob ${fileName} metadata.`)
  
          resolve(result.metadata)
        })
      })
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Error in setMetadata : ${err}.`)
      return null
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }
}