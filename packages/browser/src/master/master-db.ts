/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Jul 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import Dexie                  from 'dexie'

import {  RunContextBrowser,
          EventSystem 
       }                      from '@mubble/browser'


import {  SyncHashModel, 
          SyncHashModels,
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse,
          Segments,
          MASTER_UPDATE_EVENT,
          Mubble
       }                      from '@mubble/core'

export const Segment = {
  version: 'version'
}

const SYNC_HASH = 'syncHashTable'

class ModelField {
  constructor(public name: string,
              public type: 'string' | 'number' | 'boolean' | 'array' | 'object',
              public optional: boolean) {}
  
  toString() {
    return `${this.name}(${this.type})${this.optional ? ': optional' : ''}`
  }            
}

export abstract class MasterDb extends Dexie {

  static schemaKey    : Mubble.uObject<Mubble.uObject<ModelField>> = {}
  static schemaField  : Mubble.uObject<Mubble.uObject<ModelField>> = {}
  static classMap     : Map<Function, string>                      = new Map()

  syncHashModels: SyncHashModels = {}

  static registerModelClass(modelName: string, classFn: Function) {
    this.classMap.set(classFn, modelName)
  }

  static getModelName(classFn: Function) {
    return this.classMap.get(classFn)
  }

  static registerSchema(modelName     : string,
                        fieldName     : string,
                        isPrimaryKey  : boolean,
                        fieldType     : 'string' | 'number' | 'boolean' | 'array' | 'object',
                        optional      : boolean) {

    const field      = new ModelField(fieldName, fieldType, optional),
          collection = isPrimaryKey ? this.schemaKey : this.schemaField

    let   fields     = collection[modelName]

    if (!fields) fields = collection[modelName] = {}
    fields[field.name] = field
    // console.log(`${modelName}: added ${isPrimaryKey ? 'key' : 'field'} + ${field}`)
  }

  constructor (rc: RunContextBrowser, version: string) {

    super('MasterDb')

    const modelsWithKeys   = Object.keys(MasterDb.schemaKey).length,
          modelsWithFields = Object.keys(MasterDb.schemaField).length

    rc.isAssert() && rc.assert(rc.getName(this), modelsWithKeys && modelsWithFields 
      && modelsWithKeys >= modelsWithFields, {modelsWithKeys, modelsWithFields})


    const schema = {[SYNC_HASH]: 'model'}
    this.buildSchema(schema)
    // console.log(schema)
    this.version(1).stores(schema)

    EventSystem.subscribe(MASTER_UPDATE_EVENT, this.onMasterUpdate.bind(this))
    this.verifySegmentVersion(rc, version)
  }

  public async init(rc: RunContextBrowser) {

    const ar        = await this[SYNC_HASH].toArray(),
          modelMap  = MasterDb.schemaKey,
          models    = Object.keys(modelMap)

    for (const modelName of models) {
      const st = ar.find(item => item.model === modelName)
      this.syncHashModels[modelName] = st ? st.hash : {ts: 0}
    }
    rc.isDebug() && rc.debug(rc.getName(this), 'syncHashModels', this.syncHashModels)
  }

  public getSyncRequest(rc: RunContextBrowser): SyncRequest {
    return {hash: this.syncHashModels, segments: (rc.globalKeyVal.syncSegments as Segments)}
  }

  getTableForClass(rc: RunContextBrowser, classFn: Function) {

    const modelName = MasterDb.getModelName(classFn)
    rc.isAssert() && rc.assert(rc.getName(this), modelName, 'unknown class object', classFn)
    return this.getTable(rc, modelName)
  }

  private verifySegmentVersion(rc: RunContextBrowser, version: string) {

    let segments = rc.globalKeyVal.syncSegments as Segments
    if (!segments) segments = {}
    if (!segments[Segment.version]) segments[Segment.version] = [['']]

    const [[oldVersion]] = segments[Segment.version]
    if (oldVersion !== version) {
      console.log('oldVersion, version', oldVersion, version)
      segments[Segment.version] = [[version]]
      rc.globalKeyVal.syncSegments = segments
    } else {
      console.log('Versions are same', oldVersion, version)
    }
  }

  private buildSchema(schema) {

    const modelMap = MasterDb.schemaKey
    
    for (const modelName of Object.keys(modelMap)) {

      const ar     = Object.keys(modelMap[modelName]),
            keyStr = ar.length === 1 ? ar[0] : `[${ar.join('+')}]`
      schema[modelName + 'Table'] = keyStr
    }
  }

  private async onMasterUpdate(event: any) {

    const syncResponse:SyncResponse = event.detail.data,
          rc:RunContextBrowser      = event.detail.rc

    for (const modelName of Object.keys(syncResponse)) {

      if (!(syncResponse as object).hasOwnProperty(modelName)) continue
      const modelData: SyncModelResponse = syncResponse[modelName]

      await this.applyMasterData(rc, modelName, modelData) 
    }
  }

  private async applyMasterData(rc: RunContextBrowser, modelName: string, modelData: SyncModelResponse) {

    if (modelData.purge) {
      await this.clear(rc, modelName)
      rc.isDebug() && rc.debug(rc.getName(this), modelName, 'purged')
    } else if (modelData.del && modelData.del.length) {
      await this.bulkDelete(rc, modelName, modelData.del)
      rc.isDebug() && rc.debug(rc.getName(this), modelName, 'deleted', modelData.del.length)
    }

    if (modelData.mod && modelData.mod.length) {
      await this.bulkPut(rc, modelName, modelData.mod)
      rc.isDebug() && rc.debug(rc.getName(this), modelName, 'upsert', modelData.mod.length)
    }

    this.syncHashModels[modelName] = modelData.hash
    const syncHashTable = this[SYNC_HASH]

    await this.transaction('rw', syncHashTable, async() => {
      await syncHashTable.put({model: modelName, hash: modelData.hash})
    })
  }
  
  private async clear(rc: RunContextBrowser, modelName: string) {

    const modelTable = this.getTable(rc, modelName)

    await this.transaction('rw', modelTable, async() => {
      await modelTable.clear()
    })

  }

  private async bulkPut(rc: RunContextBrowser, modelName: string, arMod: object[]) {

    const modelTable = this.getTable(rc, modelName)

    await this.transaction('rw', modelTable, async() => {
      for (const modelRec of arMod) {
        await modelTable.put(this.buildFullRec(rc, modelName, modelRec))
      }
    })
  }

  private buildKeyRec(rc: RunContextBrowser, modelName: string, rec: Object) {

    const keyMap    = MasterDb.schemaKey[modelName],
          outRec    = {}

    for (const keyName in keyMap) {
      const key = keyMap[keyName]
      rc.isAssert() && rc.assert(rc.getName(this), rec[keyName] !== undefined, 'Rec missing PK', keyName, rec)
      outRec[keyName] = rec[keyName]
    }
    
    return outRec
  }

  private buildFullRec(rc: RunContextBrowser, modelName: string, rec: Object) {

    const fieldMap  = MasterDb.schemaField[modelName],
          outRec    = this.buildKeyRec(rc, modelName, rec)

    for (const fieldName in fieldMap) {
      const field = fieldMap[fieldName],
            value = rec[fieldName]
      rc.isAssert() && rc.assert(rc.getName(this), field.optional && value === undefined || 
        this.validateType(field.type, value), 'Invalid value for field', fieldName, rec)
      outRec[fieldName] = rec[fieldName]
    }

    return outRec
  }

  private validateType(type: string, value: any): boolean {

    switch(type) {
      case 'string':
      case 'number':
      case 'boolean':
        return typeof(value) === type
      case 'array':
        return Array.isArray(value)
      case 'object':
        return value && typeof(value) === type
      default:
        return false  
    }
  }

  private async bulkDelete(rc: RunContextBrowser, modelName: string, arDel: object[]) {

    const modelTable = this.getTable(rc, modelName)

    await this.transaction('rw', modelTable, async() => {
      for (const modelRec of arDel) {
        await modelTable.delete(this.buildKeyRec(rc, modelName, modelRec))
      }
    })
  }

  private getTable(rc: RunContextBrowser, modelName: string) {

    const modelTable = this[modelName + 'Table']
    rc.isAssert() && rc.assert(rc.getName(this), modelTable, 'unknown model', modelName)
    return modelTable

  }  

  // debug functions
  private async $all(rc: RunContextBrowser, modelName: string) {

    const modelTable = this.getTable(rc, modelName)
    const ar = await modelTable.toArray()
    console.log(ar)
  }
}

