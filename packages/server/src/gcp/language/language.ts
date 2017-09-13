/*------------------------------------------------------------------------------
   About      : Google Natural Processing - Entity Extraction
   
   Created on : Tue Sep 12 2017
   Author     : Christy George
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const language : any = require('@google-cloud/language')

import {RunContextServer}    from '../../rc-server'
import {GcloudEnv}           from '../../gcp/gcloud-env'

export type GcpEntityInfo = {
  name          : string, 
  type          : string, 
  language      : string,
  wikipedia_url : string,
  salience      : number, 
  occurences    : number
}

export class GcpLanguageBase {

  static _language : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.language = language ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.language = language ({
        projectId   : gcloudEnv.projectId
      })
    }

    this._language = gcloudEnv.language
  }

  static async analyzeEntitiesInText (rc : RunContextServer, text: string) {
    const document = { 
      content: text, 
      type: 'PLAIN_TEXT' 
    }
    return this.analyzeEntitiesInternal (rc, document)
  }

  static async analyzeEntitiesInGcs (rc : RunContextServer, bucketName : string, fileName : string) {
    const document = {
      gcsContentUri: `gs://${bucketName}/${fileName}`,
      type: 'PLAIN_TEXT'
    }
    return this.analyzeEntitiesInternal (rc, document)
  }

  static async analyzeEntitiesInternal (rc : RunContextServer, document: object) {
    const res      = await this._language.analyzeEntities ({document: document}) 
    rc.isDebug() && rc.debug (rc.getName (this), 'Entity Analysis [Text] => Language:', res[0].language, '/', res[0].entities.length, 'entries.')
    const entities = res[0].entities.map ((entityInfo: any) => {
      return { 
        name: entityInfo.name, type: entityInfo.type, language: res[0].language,
        wikipedia_url: entityInfo.metadata && entityInfo.metadata.wikipedia_url || '',
        salience: entityInfo.salience, occurences: entityInfo.mentions.length
      } as GcpEntityInfo
    })
    return entities
  }
}