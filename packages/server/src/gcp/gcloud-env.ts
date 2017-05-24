/*------------------------------------------------------------------------------
   About      : Initialize datastore with the respective credentials,
                with respect to the run mode
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
        RunContextServer,
        RUN_MODE,
       }                      from '../rc-server'
import {getSystemUserId}      from '../util/user-info'
import * as url               from 'url'
import * as http              from 'http'

const Credentials = {
  AUTH_KEY   : {
    type                        : 'service_account',
    project_id                  : 'mubble-playground',
    private_key_id              : '6f590e2b09fd8e38160547f5fcdb758862079dbf',
    private_key                 : '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC3DG9z2cV8mKNv\ne0joQxQMhoEUm9cF8bFZxOKWMpeEc/X0MjQ5kqjVNp1F5ltLfTtvP0UvXlPHUBRv\noRWdgI1CivluuuCRiJqW0XsJZf9aLqJT5g3U5ZEWS9xMn0MtlJRj5UAV1GB0Rpdi\nf/SBHZE1kTyLsToOw9OXpoCe10vhs6wHaVAqmmPFzzTtP4b5uiSELr5fhqv02BS3\nvWgOr3i4qmxB5DvKgDtvW4mYB+HeHtl/3Etx3TuQLwGam7mAKPqqJwB1eXXXph/3\nIURVh9CuemNS3hi1tAswwdmBdLC2yXYczBOA7w7fYt/LG9BriJ9Pgeq0wJvucRWk\ncXuEQ231AgMBAAECggEAV7xKH0kd8x5mF6ULyOd90JMXg30+jsbNrq1DvaH6Ja4/\nERCPH5k/+xH2R+6li4U225eD3bRki3/Ci861wYxAKMjbzUsdICRNlERLqLGOtvbr\nLzNxJb3y0LEDomYjmNFCXq8fDFeC87hyDvAtjUVSuE4oqvwDS9horqNLutaOtFrN\nUKFqKXlpCtbhDSTGSmVz/n796Qv8RunJSqr8ikLqRso7yjTmTMJhzs0H0hPePGOo\nsx0w0aqxeuKzKJEYOfS50yPgphE3IudiEao9JPVV1vb6GaT/0/xhNdKM15Ybkdin\n2kgy9/Wr0LsstuVaIWGv72Jovv6GMmw70khXr1lOAQKBgQDwRiQ5fJXATqUDTOeC\ngp0TnUl3QJivcygMFWBqvA9HGdmaCrnZuOgyOAwqqDbGn4cTPiw9d3w0gCJV6xe1\nL+KCxtnlSQqejE+nBdqdj6TS1kG9RONcfuAptyLDM0goP7+ZdIvDcVVY8LAcbAT8\nJyoZ0JgNJ0bsu8v7Dqnf/UM/lQKBgQDDB3dEr55z5sjSToFj46uaHI/VHyzLOdKW\nRfFapL9BnNKw3PVfetm8E8EFsB7zRql3geRxFp0dUKBs35CHRYKEeOJYm1op1YEi\n+Gmj0CKaHy7DMWwBN95/j/QmGTWJiofokITLBenO6pEC7DGE9sj6pdmppMHIngny\nZxBilFNc4QKBgGA5VuyGzlozpLYLqHOF524hgXh2sC8jiRg9v10/b0bkPVcJkKB3\nAtaJx6WVtEobPTchoQoEvgMwhY+vFNGFGcuR41WFyPDx9DxJheGv0yx0jeNEoWE7\nln5eT1epQ+6KiSrll8tvqeRyj7TyNZTeAmhQN3SdFDReiTREDRgdDz95AoGANAMb\ntb+4XGSiDiRNsZwYOcOAQHBN++zx0o3Yrjndn9v4/J4Q+mPDCbui8Kdlua+QpoSH\nrfk/8X99KUv+OXU6N6Ydh0/3Hc0I4ZCqa7uoXr4ONJRLn4+M0SxNCpQSiRne4REZ\nuSNclYhNICBpnHJMazwr7mg4Hg63zGPcJM415UECgYAXJ9U+4K5dW1DXp+qUr+BL\nNH2fV5efeInZn+fxLOJcYfopENCJR5Sgh+wvmuoINO/UyhdiQp78ochkjwn2m2SQ\ncye+AG33B+QM5kgnO0lNatA7ptqoQ0hlSOauV9u9mw2wf9qzGkfYDbYD/tDToJ00\nxscmnUwVL9DFWd5N7NB1+w==\n-----END PRIVATE KEY-----\n',
    client_email                : 'mubble@mubble-playground.iam.gserviceaccount.com',
    client_id                   : '114134441150157527260',
    auth_uri                    : 'https://accounts.google.com/o/oauth2/auth',
    token_uri                   : 'https://accounts.google.com/o/oauth2/token',
    auth_provider_x509_cert_url : 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url        : 'https://www.googleapis.com/robot/v1/metadata/x509/mubble%40mubble-playground.iam.gserviceaccount.com'
  }, 
  PROJECT_ID : 'mubble-playground'
}

const metadataPathPrefix     = 'http://metadata.google.internal/computeMetadata/v1/',
      metadataProjectIdCmd   = 'project/project-id',
      metadataHostNameCmd    = 'instance/hostname',
      metadataInstanceEnvCmd = 'instance/attributes/MUBBLE_ENV',
      metadataProjectEnvCmd  = 'project/attributes/PROJECT_ENV',
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

    if (rc.getRunMode() === RUN_MODE.PROD) {
      if (instanceEnv !== RUN_MODE[RUN_MODE.PROD]) throw(new Error('InstanceEnv Mismatch'))
      if (await this.getMetadata(rc, metadataProjectEnvCmd) !== RUN_MODE[RUN_MODE.PROD]) throw(new Error('InstanceEnv Mismatch'))

      const projectName = await this.getMetadata(rc, metadataProjectIdCmd)
      return new GcloudEnv(projectName, RUN_MODE[RUN_MODE.PROD])

    } else {

      if (instanceEnv) { // running at google

        const projectName = await this.getMetadata(rc, metadataProjectIdCmd)

        if (await this.getMetadata(rc, metadataProjectEnvCmd) === RUN_MODE[RUN_MODE.PROD]) {
          return new GcloudEnv(projectName, RUN_MODE[RUN_MODE.PROD])
        } else {
          const hostname = await this.getMetadata(rc, metadataHostNameCmd)
          return new GcloudEnv(projectName, hostname.split('.')[0])
        }

      } else {
        return new GcloudEnv(Credentials.PROJECT_ID, 
                             getSystemUserId().toUpperCase(),
                             Credentials.AUTH_KEY)
      }
    }
  }
  
  public datastore : any  

  constructor(public projectId  : string,
              public namespace  : string,
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
      throw Error ('RUN MODE Mismatch - Project Run Mode != Instance Run Mode')
    }
    return RUN_MODE.DEV
  }

  static async getMetadata(rc: RunContextServer, urlSuffix: string): Promise<any> {
    return new Promise((resolve, reject) => {

      let code = 200
      metadataOptions.path = metadataPathPrefix + urlSuffix
      const req = http.request(metadataOptions, (outputStream: any) => {

        if (code != 200) {
          return resolve (undefined)
        }
        else {
          let response = ''
          outputStream.on('data', (chunk: any) => {
            response += chunk
          })
          outputStream.on('end', () => {
            return resolve(response)
          })
        }
      })
      req.on('response', (res: any) => {
        code = res.statusCode
      })
      req.on('error', (err: any) => {
        rc.isStatus() && rc.status (err)
        if (err.errno && err.errno === 'ENOTFOUND') return resolve (undefined) 
        return reject(err)
      })
      req.end()
    })
  }
}
