/*------------------------------------------------------------------------------
   About      : Google Natural Processing - Entity Extraction
   
   Created on : Tue Sep 12 2017
   Author     : Christy George
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const language  : any = require('@google-cloud/language'),
      translate : any = require('@google-cloud/translate'),
      cld       : any = require('cld')

import * as lo                                    from 'lodash'
import {RunContextServer}                         from '../../rc-server'
import {GcloudEnv}                                from '../../gcp/gcloud-env'
import { RunContextNcServer } from 'framework';

export type GcpEntityInfo = {
  name          : string, 
  type          : string, 
  language      : string,
  wikipedia_url : string,
  salience      : number, 
  occurences    : number
}

export type GcpTopicInfo = {
  name       : string,
  confidence : number
}

export type GcpTranslationInfo = {
  translatedText         : string,
  detectedSourceLanguage : string
}

type CldLanguageInfo = {
  textBytes: number,
  languages: [{
    name   : string,
    code   : string,
    percent: number,
    score  : number
  }],
  chunks: [{
    name   : string,
    code   : string,
    offset : number,
    bytes  : number
  }]
}

export class GcpLanguageBase {

  static _language   : any
  static _translate  : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      this._language = new language.LanguageServiceClient ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
      this._translate = new translate({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      });    
    } else {
      this._language = new language.LanguageServiceClient ({
        projectId   : gcloudEnv.projectId
      })
      this._translate = new translate({
        projectId   : gcloudEnv.projectId
      });    
    }
  }

  static async classifyText (rc: RunContextServer, text: string) {
    const document = { 
      content: text, 
      type: 'PLAIN_TEXT'
    }
    return this.classifyInternal (rc, 'Text:' + text.length, document)
  }

  static async classifyGcsFile (rc: RunContextServer, bucketName : string, fileName : string) {
    const document = {
      gcsContentUri: `gs://${bucketName}/${fileName}`,
      type: 'PLAIN_TEXT' 
    }
    return this.classifyInternal (rc, 'GCS:' + fileName, document)
  }
      
  static async analyzeEntitiesInText (rc : RunContextServer, text: string) {
    const document = { 
      content: text, 
      type: 'PLAIN_TEXT' 
    }
    return this.analyzeEntitiesInternal (rc, 'Text' + text.length, document)
  }

  static async analyzeEntitiesInGcs (rc : RunContextServer, bucketName : string, fileName : string) {
    const document = {
      gcsContentUri: `gs://${bucketName}/${fileName}`,
      type: 'PLAIN_TEXT'
    }
    return this.analyzeEntitiesInternal (rc, 'GCS:' + fileName, document)
  }

  // TODO: Can support threshold as an argument.
  private static async analyzeEntitiesInternal (rc : RunContextServer, tag: string, document: any) : Promise<Array<GcpEntityInfo>> {
    const res      = await this._language.analyzeEntities ({document: document}) 
    const entities = res[0].entities.map ((entityInfo: any) => {
      return { 
        name: entityInfo.name, type: entityInfo.type, language: res[0].language,
        wikipedia_url: entityInfo.metadata 
                    && entityInfo.metadata.wikipedia_url 
                    && entityInfo.metadata.wikipedia_url.replace ('https://en.wikipedia.org/wiki/', '') 
                    || '',
        salience: entityInfo.salience, occurences: entityInfo.mentions.length
      } as GcpEntityInfo
    })
    rc.isDebug() && this.findDuplicates (rc, entities)
    // NOTE: There are duplicates in name with different salience value.. We take the first..
    const uniqueEntities = lo.uniqBy (entities, 'name') as Array<GcpEntityInfo>
    rc.isDebug() && rc.debug (rc.getName (this), 'Entity Analysis [' + tag + '] => Language:', res[0].language, 
          '/', res[0].entities.length, 'entries, Unique Entries:', uniqueEntities.length)
    return uniqueEntities
  }

  static findDuplicates (rc: RunContextServer, entities: Array<GcpEntityInfo>) {
    const uniq = entities.map ((eInfo: GcpEntityInfo) => {
      return { name: eInfo.name, count: 1, saliencies: [eInfo.salience], occurences: [eInfo.occurences] }
    }).reduce ((accum: any, obj: any) => { 
      const val = accum[obj.name] || { name: obj.name, count: 0, saliencies: [], occurences: []}
      val.count = val.count + obj.count
      val.saliencies.push (...obj.saliencies)
      val.occurences.push (...obj.occurences)
      accum[obj.name] = val
      return accum
    }, {})
    const dups = Object.keys (uniq).filter ((a: string) => uniq[a].count > 1)
    if (dups.length) rc.isDebug && rc.debug (rc.getName (this), '\t==>Duplicates:', JSON.stringify (dups))
  }

  static getTopNTags (rc: RunContextNcServer, entities: Array<GcpEntityInfo>, count: number) {
    const allTags = lo(entities).orderBy(['occurences', 'salience'], ['desc', 'desc'])
    .flatMap((v : any) => {
      if(v.occurences == 1) return []
      if(v.name.split(' ') > 1) return [v.name]
      if(v.name.charCodeAt(0) >= 65 && v.name.charCodeAt(0) < 97) return [v.name]
      return []
    })
    .value()
    return allTags.slice(0, count)  // Give max 'count' tags
}
  
  private static async classifyInternal (rc : RunContextServer, tag: string, document: any) : Promise<Array<GcpTopicInfo>> {
    try {
      const res   =  await this._language.classifyText ({document: document}) 
      rc.isDebug() && rc.debug (rc.getName (this), 'Topics ['+ tag + ']=', JSON.stringify (res[0].categories))
      if (res[0].categories.length === 0) return [{name: '/Other', confidence: 0.95}]
      return res[0].categories
    }
    catch (e) {
      rc.isWarn () && rc.warn (rc.getName (this), 'Error ['+ tag + ']:', e)
      return [{name: '/Other', confidence: 0.95}]
    }
  }

  static async detectLanguage(rc: RunContextServer, text: string) : Promise<any> {
    const cldOptions = {
      isHTML       : false,
      // languageHint : 'BULGARIAN',
      // encodingHint : 'ISO_8859_5',
      // tldHint      : 'bg',
      // httpHint     : 'bg'
    }
    const cldres = await new Promise((resolve, reject) => {
      cld.detect(text, cldOptions, (error : any, response : CldLanguageInfo) => {
        if (error) {
          rc.isWarn () && rc.warn (rc.getName (this), 'Error Detecting Language:', error)
          return resolve ('en')
        }
        if (response.languages.length == 0) {
          rc.isWarn () && rc.warn (rc.getName (this), 'No Language Detected, Assuming English')
          return resolve ('en')
        }
        if (response.languages.length > 1) {
          const langCodes = lo.map (response.languages, (lang) => lang.name + ':' + lang.percent)
          rc.isStatus () && rc.status (rc.getName (this), 'Multiple Language Detected:', JSON.stringify (langCodes))
        }
        if (response.languages[0].percent < 80) {
          rc.isWarn () && rc.warn (rc.getName (this), 'Detected Language has a lower threshold', response.languages[0].code)
        }
        resolve (response.languages[0].code)
      })  
    })
    return cldres
  }

  static async translateToEnglish (rc: RunContextServer, text: string) : Promise<GcpTranslationInfo | null> {
    try {
      const res   =  await this._translate.translate (text, 'en') 
      return res[1].data.translations[0]
    }
    catch (e) {
      rc.isWarn () && rc.warn (rc.getName (this), 'Error:', e)
      return null
    }
  }

}
