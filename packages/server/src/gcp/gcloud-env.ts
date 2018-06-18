/*------------------------------------------------------------------------------
   About      : Initialize google-cloud with the respective credentials,
                with respect to the run mode
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/




/*------------------------------------------------------------------------------
Running local datastore emulator

Following command emits the env vars
> gcloud beta emulators datastore env-init 
export DATASTORE_DATASET=playground-india
export DATASTORE_EMULATOR_HOST=localhost:8081
export DATASTORE_EMULATOR_HOST_PATH=localhost:8081/datastore
export DATASTORE_HOST=http://localhost:8081
export DATASTORE_PROJECT_ID=playground-india

To set them automatically as env var $(gcloud beta emulators datastore env-init)

------------------------------------------------------------------------------*/

import {
        RunContextServer,
        RUN_MODE,
       }                            from '../rc-server'
import {
        BaseDatastore,
        MonitoringBase,
        VisionBase,
        BigQueryBase,
        PubSubBase,
        GcpLanguageBase,
        TraceBase
       }                            from '../index'
import * as http                    from 'http'

const metadataPathPrefix     = 'http://metadata.google.internal/computeMetadata/v1/',
      metadataProjectIdCmd   = 'project/project-id',
      metadataHostNameCmd    = 'instance/hostname',
      metadataInstanceEnvCmd = 'instance/attributes/NC_ENV',
      metadataProjectEnvCmd  = 'project/attributes/NC_PROJECT_ENV',
      metadataBqEnvCmd       = 'project/attributes/NC_BQ_ENV',
      azureCdnCmd            = 'project/attributes/AZURE_CDN',
      oAuthClientIdCmd       = 'project/attributes/OAUTH_CLIENT_ID'

const metadataOptions : http.RequestOptions = {
        host: 'metadata.google.internal',
        port: 80,
        path: this.pathPrefix + this.projectIdCmd,
        method: 'GET',
        headers: {
          "Metadata-Flavor": 'Google'
        }
      }

export class GcloudEnv {

  public datastore           : any
  public cloudStorage        : any 
  public vision              : any 
  public bigQuery            : any
  public pubsub              : any
  public monitoring          : any

  public authKey             : Object
  public projectId           : string
  public bqAuthKey           : Object
  public azureCdn            : string
  static oAuthClientId       : string
  
  private static instanceEnv : string
  private static projectEnv  : string
  private static hostName    : string

  constructor(public namespace : string) {
  }

  private async setMetadata(rc : RunContextServer) {
    GcloudEnv.instanceEnv   = await GcloudEnv.getMetadata(rc, metadataInstanceEnvCmd)
    GcloudEnv.projectEnv    = await GcloudEnv.getMetadata(rc, metadataProjectEnvCmd)
    GcloudEnv.hostName      = await GcloudEnv.getMetadata(rc, metadataHostNameCmd)
    GcloudEnv.oAuthClientId = await GcloudEnv.getMetadata(rc, oAuthClientIdCmd)
    this.azureCdn           = await GcloudEnv.getMetadata(rc, azureCdnCmd)

    if(!this.azureCdn) rc.isError() && rc.error(rc.getName(this), 'azureCdn Not Defined')

    this.projectId   = await GcloudEnv.getMetadata(rc, metadataProjectIdCmd)
    
    const bqAuthKey  = await GcloudEnv.getMetadata(rc, metadataBqEnvCmd)
    this.bqAuthKey   = bqAuthKey ? JSON.parse(bqAuthKey) : undefined
  }

  static async init(rc : RunContextServer, authKey ?: Object): Promise<GcloudEnv> {

    let gCloudEnv
    //Local Server
    if(process.env.MUBBLE_LOCAL_SERVER == 'true') {
      gCloudEnv = new GcloudEnv(RUN_MODE[RUN_MODE.DEV])

    } else {
      //Running at GCP
      const hostName  = await GcloudEnv.getMetadata(rc, metadataHostNameCmd),
            runMode   = rc.getRunMode(),
            namespace = runMode === RUN_MODE.DEV && this.projectEnv !== RUN_MODE[RUN_MODE.PROD] && hostName
                        ? hostName.split('.')[0].toUpperCase()
                        : RUN_MODE[runMode]

      gCloudEnv = new GcloudEnv(namespace)
      await gCloudEnv.setMetadata(rc)

      if (rc.getRunMode() === RUN_MODE.PROD) {
         if (this.instanceEnv !== RUN_MODE[RUN_MODE.PROD]) throw(new Error('InstanceEnv Mismatch'))
         if (this.projectEnv !== RUN_MODE[RUN_MODE.PROD])  throw(new Error('ProjectEnv Mismatch'))
      }
    }

    if(!gCloudEnv.bqAuthKey && authKey) gCloudEnv.bqAuthKey = authKey
    await this.initGcpComponents(rc, gCloudEnv)

    return gCloudEnv
  }

  private static async initGcpComponents(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    await BaseDatastore.init(rc, gcloudEnv)
    await MonitoringBase.init(rc, gcloudEnv)
    await VisionBase.init(rc, gcloudEnv)
    await BigQueryBase.init(rc, gcloudEnv)
    await PubSubBase.init(rc, gcloudEnv)
    await GcpLanguageBase.init(rc, gcloudEnv)
    await TraceBase.init(rc, gcloudEnv)
  }

  // Static Functions to get Metadata Info
  async getProjectId(rc: RunContextServer): Promise<any> {
    return GcloudEnv.getMetadata(rc, metadataProjectIdCmd)
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

  static async getMetadata(rc : RunContextServer, urlSuffix : string): Promise<any> {
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
