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

const Credentials = {
  AUTH_KEY   : {
  type                        : "service_account",
  project_id                  : "playground-india",
  private_key_id              : "039b1746245f883caf08953476d48d57fd59f301",
  private_key                 : "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDJLoNczvvImnpX\nIve1ILnluQgWkfzjrlvq2hJiltpiFuhbVSOmg/IkyKJ51+MseVQSvF5iAGIsJo3U\niGPUO8l90POcQOlfUWIEN9Z+RzfoFRosCkmQhgFxMdAuiqZXF0El76lu/rp4aDj7\nIEw/1jwRUo6WAMsPYHc2OrG1KzKI5hzC5YDOLi5AenxIkOjSEkEvlb5OQp73IU+g\nZdhN4foN4gWUQrPODC+e2kAW1Cewml3q+QuV1xhKMOY0hQNHpRm9uUzvgh0FfN2y\nWUdREw5JE3faFJJg+/mmln3cBaWblE4b8KaWdRbl/DbjDLLQBaZPbbLVxABl3J2B\nmAX9HarlAgMBAAECggEARFZJ5d0jNrWOiAnHNZ37t3Y+Mph9XAOOknxn0VhnrvkU\nDW4isX3RY0BJvHSiZKmD7udQch6qOlAQTljT/DQg0d2H2pRMEYYt8rva3sMnUOzW\nGo6WBYMXe1FN43lSXnP2O8Iofh0Fzz+r11XVwLtvZPzzlS2IzFzasa+HTMBzJn/V\nLx3563yzKg6SHjM1AAx0dsrYf5zHXdUPJPPp9s3XP7mdAghqIr4jvEZg6eLzicpx\nu/2kWJG+lYuSFkuRmYNarBnyylKpZiqkSUFkZK0gxc5MxXpLT4kE9CoufrVP/pf6\ne7wpLDJ2WuGxu4g/GLZ3N7Ley0wN46hIHhJ+tyi7UwKBgQD1fYyjLvAxkJeS+oMb\nA93gqw+JbydIqa6CnB1j2xJaOjExgz+YaIbbrw6mJyJ2o2oHefC1CPwtP+I+EohQ\nCK7+1NRDh+zHUwpE5G3fbuCcuLQfX5MSMUx2nvRNSbIThh5KzkAUk15y2XPH0zKf\nYts3R199i3dOy+FBTVJ6k39WwwKBgQDRy1zMVSveGci/YTVpiXFcEfjw8YO7PVmJ\nTP6rDVt+h2LgCqvD2n4JjstUMwDVTqUpndYzjeUTie3JqV74y4c0tDsD6olTmDdn\nIflwfv02UvsId2OBmkoejJ63Cd4moE7xHrqpkh6tsXdpuq4E5x58gdd/oMGBW6Dw\n2cSW9NttNwKBgQDsS17Vq9aTPuRHG06a8Evfd4hK92zOqlVJbs9zUGkH5D95syXB\no8s7JfNpxv2LSJxEegFRoEZrn7Q7n0cKEnGu5Fk0b19gNPQLf/yqNmWJNNhb4nkD\n5+P7weDRjAAWfuAljQVtSLR+xASH8Sgm9tafDNpDU70RYXl+i9i6F8NYVQKBgQCr\n1pa8B0dXNGdp2oWVXC6t60qskCYGR8n+3EH8eYRnrx0dxZ/LXDvAOGXzIZOdJD3E\nSLQapi7sQh2zADf6MTsdwEJWgtTY0+UNZJabvmhJBs73sFKg5W+wdh3Kbxq3KLeA\naFscacMXIjVdNLs06Nnfwbpxn4rgGd1JahXMT+MrIQKBgQCJSAiKFZGWLhbi1u0R\nNJ1xvQ9ma7Kl/6+6wgfXugZIFxDmT4Y+Cx5FKFg2sjenD6kuVqNA0gPS6zb5kdYw\nFXo/9itjMGmgxf0opS0xbKbafcB9f3T17mgHe1QV9HJcKmCq7lSuJwsEgEJRIGCe\nKpG1dyQGZOlQylruuWKj6uYY6g==\n-----END PRIVATE KEY-----\n",
  client_email                : "full-access@playground-india.iam.gserviceaccount.com",
  client_id                   : "111361654706931424939",
  auth_uri                    : "https://accounts.google.com/o/oauth2/auth",
  token_uri                   : "https://accounts.google.com/o/oauth2/token",
  auth_provider_x509_cert_url : "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url        : "https://www.googleapis.com/robot/v1/metadata/x509/full-access%40playground-india.iam.gserviceaccount.com"
}, 
  PROJECT_ID : 'playground-india'
}

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
    
    const instanceEnv = await this.getMetadata(rc, metadataInstanceEnvCmd)
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
          gCloudEnv = new GcloudEnv(projectName, RUN_MODE[RUN_MODE.PROD], parsedBqKey, azureCdn)
        } else {
          const hostname = await this.getMetadata(rc, metadataHostNameCmd)
          gCloudEnv = new GcloudEnv(projectName, hostname.split('.')[0], parsedBqKey, azureCdn)
        }

      } else {
        gCloudEnv = new GcloudEnv(Credentials.PROJECT_ID, 
                                  getDatastoreNamespace().toUpperCase(),
                                  Credentials.AUTH_KEY,
                                  undefined,
                                  Credentials.AUTH_KEY)
      }
    }
    await this.initGcpComponents(rc, gCloudEnv)
    return gCloudEnv
  }

  private static async initGcpComponents(rc: RunContextServer, gcloudEnv : any) {
    // TODO: Take a list of components to initialize...
    await BaseDatastore.init (rc, gcloudEnv)
    await MonitoringBase.init(rc, gcloudEnv)
    await VisionBase.init(rc, gcloudEnv)
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

  constructor(public projectId  : string,
              public namespace  : string,
              public bqAuthKey  : object,
              public azureCdn  ?: string,
              public authKey   ?: object) {
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
