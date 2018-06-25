/*------------------------------------------------------------------------------
   About      : Azure Blob Storage Base
   
   Created on : Wed May 16 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}   from '../../rc-server'
import {Mubble}             from '@mubble/core' 
import * as storage         from 'azure-storage'
import * as path            from 'path'
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
                                       fullPath: string, fileName: string) {

    const traceId   = `uploadDataToBlobStorage : ${fileName}`,
          ack       = rc.startTraceSpan(traceId),
          pathArr   = fullPath.split('/'),
          container = pathArr.shift() as string,
          filePath  = path.join(...pathArr, fileName)
          
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

  static async getWriteStream(rc: RunContextServer, container: string, file: string) {
    return this._blobstorage.createWriteStreamToBlockBlob(container, file)
    //   (err : Error, result : any, response : storage.ServiceResponse) => {
    //     if(err) {
    //       rc.isDebug() && rc.debug(rc.getName(this), 'Error response', response)
    //       rc.isError() && rc.error(rc.getName(this), `Error in Azure write stream (${file})`, err)
    //     }
    //   }
    // )
  }

  static async getReadStream(rc: RunContextServer, container: string, file: string) {
    return this._blobstorage.createReadStream(container, file, {}, 
      (err : Error, result : any, response : storage.ServiceResponse) => {
        if(err) {
          rc.isDebug() && rc.debug(rc.getName(this), 'Error in Azure getReadStream response', response)
          rc.isError() && rc.error(rc.getName(this), `Error in Azure getReadStream (${file})`, err)
        }
      }
    )
  }
  

  static async listFiles(rc: RunContextServer, container: string, prefix ?: string, includeMetadata ?: boolean) {

    const BS = this._blobstorage,
          fn = prefix ? BS.listBlobsSegmentedWithPrefix.bind(BS, container, prefix)
                      : BS.listBlobsSegmented.bind(BS, container),
          list: Array<storage.BlobService.BlobResult> = []
    
    let token = null
    do  {
      token = await this.listFilesInternal(fn, list, token, includeMetadata)
      token && rc.isDebug() && rc.debug(rc.getName(this), 'Continuing... Current length', list.length)
    } while (token)

    return list
  }

  private static async listFilesInternal(fn               : any,
                                         list             : Array<storage.BlobService.BlobResult>,
                                         token            : any,
                                         includeMetadata ?: boolean) {

    const options = includeMetadata ? {maxResults : 5000, include : 'metadata'}
                                    : {maxResults : 5000},
          result  = await Mubble.uPromise.execFn(fn, null, token, options)
    list.push(...result.entries)
    return result.continuationToken
  }

  static async setMetadata(rc : RunContextServer, container : string, fileName : string, metaKey : string, metaValue : string) {
    const traceId                                = `setMetadata : ${fileName} | ${metaKey} : ${metaValue}`,
          ack                                    = rc.startTraceSpan(traceId),
          metadata : {[index : string] : string} = {}

    metadata[metaKey] = metaValue

    try {
      const newMetadata = await new Promise((resolve, reject) => {
        this._blobstorage.setBlobMetadata(container, fileName, metadata, (error : Error, result : storage.BlobService.BlobResult, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in setting blob ${fileName} metadata (${metaKey} : ${metaValue}) : ${error.message}.`)
            reject(error)
          }
  
          if(response.isSuccessful) rc.isStatus() && rc.status(rc.getName(this), `Succesfully set blob ${fileName} metadata.`)
  
          resolve(result.metadata)
        })
      })

      return newMetadata
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Error in setMetadata : ${err}.`)
      return null
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  static async getMetadata(rc : RunContextServer, container : string, fileName : string) {
    const traceId = `getMetadata : ${fileName}`,
          ack     = rc.startTraceSpan(traceId)

    try {
      const metadata = await new Promise((resolve, reject) => {
        this._blobstorage.getBlobMetadata(container, fileName, (error : Error, result : storage.BlobService.BlobResult, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in getting blob ${fileName} metadata : ${error.message}.`)
            reject(error)
          }

          resolve(result.metadata)
        })
      })

      return metadata
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Error in getMetadata : ${err}.`)
      return {}
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  static async getFileBuffer(rc : RunContextServer, container : string, fileName : string) {
    const traceId   = `downloadDataFromBlobStorage : ${fileName}`,
          ack       = rc.startTraceSpan(traceId)

    try {
      const readableStream = this._blobstorage.createReadStream(container, fileName, (error : Error, result : storage.BlobService.BlobResult, response : storage.ServiceResponse) => {
        if(error) {
          rc.isError() && rc.error(rc.getName(this), `Error in creating Azure Blob Service write stream (${fileName}) : ${error.message}.`)
          throw(error) 
        }
      })

      const chunks   : Array<any> = [],
            response : Buffer     = await new Promise((resolve, reject) => {
        readableStream
        .on('error', (error : Error) => { 
          rc.isError() && rc.error (rc.getName(this), `ABS Read Stream : ${container}/${fileName}, Error : ${error.message}.`)
          reject(error) 
        })
        .on('data', (chunk : any) => {
            chunks.push(chunk)
        })
        .on('end', () => { 
          rc.isStatus() && rc.status(rc.getName(this), `Downloaded ${fileName} from Azure Blob Storage.`)
          resolve(Buffer.concat(chunks))
        })
      }) as Buffer
      return response
    } finally { 
      rc.endTraceSpan(traceId, ack)
    }
  }

  static async deleteFile(rc : RunContextServer, container : string, fileName : string) {
    const traceId   = `deleteDataFromBlobStorage : ${fileName}`,
          ack       = rc.startTraceSpan(traceId),
          options   = {deleteSnapshots : 'BLOB_AND_SNAPSHOTS'} as storage.BlobService.DeleteBlobRequestOptions

    try {
      const response = await new Promise<boolean>((resolve, reject) => {
        this._blobstorage.deleteBlobIfExists(container, fileName, options, (error : Error, result : boolean, response : storage.ServiceResponse) => {
          if(error) {
            rc.isError() && rc.error(rc.getName(this), `Error in deleting blob ${fileName} : ${error}.`)
            reject(error)
          }
          if(result) rc.isStatus() && rc.status(rc.getName(this), `Blob ${fileName} deleted succesfully from container ${container}.`)
          else rc.isStatus() && rc.status(rc.getName(this), `Blob ${fileName} doesnot exist in container ${container}.`)
          resolve(result)
        })
      })
      return response
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Error in deleteFile : ${err}.`)
      return false
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }
}