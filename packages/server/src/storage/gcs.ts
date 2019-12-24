/*------------------------------------------------------------------------------
   About      : Google Cloud Storage
   
   Created on : Tue Nov 19 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Storage,
         SaveOptions
       }                      from '@google-cloud/storage'
import { RunContextServer }   from '../rc-server'

export type SaveFileOptions = SaveOptions 

export class GoogleCloudStorage {

  private static storage     : Storage
  private static initialized : boolean = false

  public static init(rc : RunContextServer, projectId : string, credentialsPath : string) {

    if(this.initialized) {
      rc.isError() && rc.error(rc.getName(this), 'Calling init twice.')
      throw new Error('Calling init twice.')
    }

    this.storage     = new Storage({projectId, keyFilename : credentialsPath})
    this.initialized = true
  }

  public static async saveFile(rc        : RunContextServer,
                               bucket    : string,
                               filePath  : string,
                               fileData  : Buffer,
                               options  ?: SaveFileOptions) : Promise<string> {

    if(!this.initialized) {
      rc.isError() && rc.error(rc.getName(this), 'GCS not initialized.')
      throw new Error('GCS not initialized.')
    }
    
    rc.isDebug() && rc.debug(rc.getName(this), 'Saving file in GCS.', bucket, filePath, options)

    const file = await this.storage.bucket(bucket).file(filePath)

    await file.save(fileData, options)

    return filePath
  }

  public static async deleteFile(rc : RunContextServer, bucket : string, filePath : string) {

    const file = await this.storage.bucket(bucket).file(filePath)

    await file.delete()
  }

  public static async fileExists(rc       : RunContextServer,
                                 bucket   : string,
                                 filePath : string) : Promise<boolean> {
    if (!this.initialized) {
      rc.isError() && rc.error(rc.getName(this), 'GCS not initialized.')
      throw new Error('GCS not initialized.')
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'Checking if file exists in GCS.', 
                             bucket, filePath)
    
    const file   = await this.storage.bucket(bucket).file(filePath),
          exists = await file.exists()

    return exists[0]
  }
}