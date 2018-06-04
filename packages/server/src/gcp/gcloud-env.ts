/*------------------------------------------------------------------------------
   About      : Initialize google-cloud with the respective credentials,
                with respect to the run mode
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
        RunContextServer,
        RUN_MODE,
       }                            from '../rc-server'
import {
        BaseDatastore,
        getDatastoreNamespace,
        CloudStorageBase,
        MonitoringBase,
        VisionBase,
        BigQueryBase,
        PubSubBase,
        GcpLanguageBase,
        TraceBase
       }                            from '../index'
import * as url                     from 'url'
import * as http                    from 'http'

const metadataPathPrefix     = 'http://metadata.google.internal/computeMetadata/v1/',
      metadataProjectIdCmd   = 'project/project-id',
      metadataHostNameCmd    = 'instance/hostname',
      metadataInstanceEnvCmd = 'instance/attributes/NC_ENV',
      metadataProjectEnvCmd  = 'project/attributes/NC_PROJECT_ENV',
      metadataBqEnvCmd       = 'project/attributes/NC_BQ_ENV',
      azureCdnCmd            = 'project/attributes/AZURE_CDN',
      metadataOptions : http.RequestOptions   = {
        host: 'metadata.google.internal',
        port: 80,
        path: this.pathPrefix + this.projectIdCmd,
        method: 'GET',
        headers: {
          "Metadata-Flavor": 'Google'
        }
      }

export class GcloudEnv {

  static async init(rc : RunContextServer): Promise<GcloudEnv> {
    
    const instanceEnv = process.env.MUBBLE_LOCAL_SERVER === 'true' ? undefined  :  
                        await this.getMetadata(rc, metadataInstanceEnvCmd)

    let   gCloudEnv   = null

    if(rc.getRunMode() === RUN_MODE.LOAD) {
      const projectName = await this.getMetadata(rc, metadataProjectIdCmd),
            bqAuthKey   = await this.getMetadata(rc, metadataBqEnvCmd),
            azureCdn    = await this.getMetadata(rc, azureCdnCmd),
            parsedBqKey = bqAuthKey ? JSON.parse(bqAuthKey) : undefined

      if(!azureCdn) rc.isError() && rc.error(rc.getName(this), 'azureCdn : ' + azureCdn)      
      if(instanceEnv) gCloudEnv = new GcloudEnv(projectName, RUN_MODE[RUN_MODE.LOAD], parsedBqKey, azureCdn)
      else gCloudEnv = new GcloudEnv(Credentials.PROJECT_ID, RUN_MODE[RUN_MODE.LOAD], Credentials.AUTH_KEY, azureCdn, Credentials.AUTH_KEY)

      await this.initGcpComponents(rc, gCloudEnv)
      return gCloudEnv
    }

    if (rc.getRunMode() === RUN_MODE.PROD) {
      if (instanceEnv !== RUN_MODE[RUN_MODE.PROD]) throw(new Error('InstanceEnv Mismatch'))
      if (await this.getMetadata(rc, metadataProjectEnvCmd) !== RUN_MODE[RUN_MODE.PROD]) throw(new Error('InstanceEnv Mismatch'))

      const projectName = await this.getMetadata(rc, metadataProjectIdCmd),
            bqAuthKey   = await this.getMetadata(rc, metadataBqEnvCmd),
            azureCdn    = await this.getMetadata(rc, azureCdnCmd),
            parsedBqKey = bqAuthKey ? JSON.parse(bqAuthKey) : undefined

      if(!azureCdn) rc.isError() && rc.error(rc.getName(this), 'azureCdn : ' + azureCdn)      
      gCloudEnv = new GcloudEnv(projectName, RUN_MODE[RUN_MODE.PROD], parsedBqKey, azureCdn)

    } else {

      if (instanceEnv) { // running at google

        const projectName = await this.getMetadata(rc, metadataProjectIdCmd),
              bqAuthKey   = await this.getMetadata(rc, metadataBqEnvCmd),
              azureCdn    = await this.getMetadata(rc, azureCdnCmd),
              parsedBqKey = bqAuthKey ? JSON.parse(bqAuthKey) : undefined

        if(!azureCdn) rc.isError() && rc.error(rc.getName(this), 'azureCdn : ' + azureCdn)      
        if (await this.getMetadata(rc, metadataProjectEnvCmd) === RUN_MODE[RUN_MODE.PROD]) {
          gCloudEnv = new GcloudEnv(RUN_MODE[RUN_MODE.PROD], projectName, bqAuthKey, azureCdn)
        } else {
          const hostname = await this.getMetadata(rc, metadataHostNameCmd)
          gCloudEnv = new GcloudEnv(hostname.split('.')[0].toUpperCase(), projectName, parsedBqKey, azureCdn)
        }

      } else {
        gCloudEnv = new GcloudEnv(RUN_MODE[RUN_MODE.DEV])
      }
    }
    await this.initGcpComponents(rc, gCloudEnv)
    return gCloudEnv
  }

  private static async initGcpComponents(rc: RunContextServer, gcloudEnv : any) {
    // TODO: Take a list of components to initialize...
    await BaseDatastore.init(rc, gcloudEnv)
    await MonitoringBase.init(rc, gcloudEnv)
    await VisionBase.init(rc, gcloudEnv) // Not being used
    await BigQueryBase.init(rc, gcloudEnv)
    await PubSubBase.init(rc, gcloudEnv)
    await GcpLanguageBase.init(rc, gcloudEnv)
    await TraceBase.init(rc, gcloudEnv)
  }
  
  public datastore    : any
  public cloudStorage : any 
  public vision       : any 
  public bigQuery     : any
  public pubsub       : any
  public monitoring   : any
  public authKey      : any

  constructor(public namespace  : string,
              public projectId ?: string,
              public bqAuthKey ?: object,
              public azureCdn  ?: string) {
    
  }

  // Static Functions to get Metadata Info
  static async getProjectId(rc: RunContextServer): Promise<any> {
    return this.getMetadata(rc, metadataProjectIdCmd)
  }

  static async checkGcpEnv(rc : RunContextServer): Promise<RUN_MODE> {
    const instanceEnv = await this.getMetadata(rc, metadataInstanceEnvCmd),
          projectEnv  = await this.getMetadata(rc, metadataProjectEnvCmd)

    if (instanceEnv && instanceEnv == 'PROD' && instanceEnv == projectEnv) {
      return RUN_MODE.PROD
    }
    else if ((instanceEnv || projectEnv) && instanceEnv !== projectEnv) {
      throw Error('RUN MODE Mismatch - Project Run Mode != Instance Run Mode')
    }
    return RUN_MODE.DEV
  }

  static async getMetadata(rc: RunContextServer, urlSuffix: string): Promise<any> {
    return new Promise((resolve, reject) => {

      metadataOptions.path = metadataPathPrefix + urlSuffix

      const req = http.request(metadataOptions, (outputStream : any) => {
        let response = ''
        outputStream.on('data', (chunk: any) => {
          response += chunk
        })
        outputStream.on('end', () => {
          return resolve(response)
        })       
      })
      req.on('response', (res: any) => {
        if(res.statusCode != 200) {
          return resolve(undefined)
        }
      })
      req.on('error', (err: any) => {
        if (err.errno && err.errno === 'ENOTFOUND') return resolve(undefined)
        rc.isStatus() && rc.status (err)
        return reject(err)
      })
      req.end()
    })
  }
}
